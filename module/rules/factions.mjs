// module/rules/factions.mjs
//
// Дерево принадлежностей: разбор ссылок `parent` между Фракциями
// (module/data/item/faction.mjs). Ненависть к Хаосу достаёт и роту в составе
// его легиона, поэтому «подходит ли цель» — это вопрос «лежит ли её фракция в
// поддереве той, что указана в Таланте».
//
// Здесь только чистые функции: ни game, ни ui, ни fromUuid. Отсюда и решение
// хранить в `parentKey` КЛЮЧ, а не UUID — разрешение uuid асинхронно и тянет за
// собой Foundry, и предикаты (rules/predicates.mjs) перестали бы проверяться
// тестом без запуска игры.
//
// Вход везде одинаковый: `byKey` — обычная карта «ключ → фракция», где у
// фракции есть `system.parentKey` (или просто `parentKey` у литерала теста).

// ── Реестр дерева ───────────────────────────────────────────────────────────
//
// Предикаты обязаны быть чистыми функциями, а разбор цепочки предков требует
// знать ВСЕ фракции — их каталог лежит в компендиуме и читается асинхронно.
// Протаскивать карту через контекст каждого броска значило бы править все
// точки входа, поэтому карта живёт здесь, а наполняет её сторона Foundry один
// раз при готовности мира.
//
// Тот же приём, что у реестра источников правил (rules/sources.mjs): модульная
// переменная плюс очистка для тестов. Предикаты по-прежнему не знают ни про
// game, ни про компендиумы.

let _index = new Map();

/** Кладёт каталог фракций в реестр. На входе предметы либо литералы. */
export function setFactionIndex(list = []) {
  _index = indexFactions(list);
  return _index;
}

/** Текущее дерево. Пустое, пока мир не загрузился: правило просто не сработает. */
export function getFactionIndex() {
  return _index;
}

/** Очистка. Нужна тестам, чтобы подставить своё дерево и вернуть как было. */
export function clearFactionIndex() {
  _index = new Map();
}

/**
 * Ключ вышестоящей фракции у записи любого вида: предмет Foundry, запись
 * индекса компендиума либо литерал теста.
 *
 * Прежнее имя поля (`parent`) читается тоже: индекс пака отдаёт сырые данные,
 * и в непересобранном компендиуме поле ещё старое. Значение, не являющееся
 * строкой, считается отсутствующим — в старых записях там мог оказаться целый
 * документ (см. шапку module/data/item/faction.mjs).
 */
export function factionParentKey(faction) {
  const raw = faction?.system?.parentKey ?? faction?.parentKey
           ?? faction?.system?.parent    ?? faction?.parent;
  if (typeof raw !== "string") return "";
  const key = raw.trim();
  return key === "[object Object]" ? "" : key;
}

const parentOf = factionParentKey;

/**
 * Дополнительные принадлежности записи: фракции, которым она служит, не
 * будучи их частью по устройству (Караул Смерти — Ордо Ксенос). Отличаются от
 * `parentKey` тем, что в дереве не участвуют: только в отборе правил.
 */
export function factionAlsoKeys(faction) {
  const raw = faction?.system?.alsoIn ?? faction?.alsoIn;
  if (!Array.isArray(raw)) return [];
  return raw.filter(k => typeof k === "string").map(k => k.trim()).filter(Boolean);
}

/** Ключ самой записи: предмет Foundry либо литерал теста. */
export function factionKey(faction) {
  return String(faction?.system?.key ?? faction?.key ?? "").trim();
}

/**
 * Карта «ключ → фракция» из списка. Записи без ключа пропускаются: без ключа
 * на них всё равно нельзя сослаться. Повтор ключа — ошибка данных: побеждает
 * первая запись, о второй сообщаем, потому что молча выбранная из двух
 * фракций ищется днями.
 */
export function indexFactions(list = []) {
  const byKey = new Map();
  for (const f of list) {
    const key = factionKey(f);
    if (!key) continue;
    if (byKey.has(key)) {
      console.error(`Warhammer DBC | фракции: ключ «${key}» встречается больше одного раза, взята первая запись`);
      continue;
    }
    byKey.set(key, f);
  }
  return byKey;
}

/**
 * Цепочка от фракции вверх до корня: [своя, родитель, дед, ...].
 *
 * Цикл в данных (A родитель B, B родитель A) не роняет обход: повтор ключа
 * обрывает цепочку и жалуется в консоль. Неизвестный ключ родителя тоже
 * обрывает — но молчит: ссылка на ещё не заведённую фракцию это нормальное
 * состояние наполняемого каталога, а не поломка.
 *
 * @returns {string[]} ключи от самой фракции к корню; пустой список, если
 *   ключ пуст или такой фракции в карте нет.
 */
export function factionChain(key, byKey) {
  const start = String(key ?? "").trim();
  if (!start || !byKey?.has?.(start)) return [];

  const chain = [];
  const seen = new Set();
  let current = start;
  while (current) {
    if (seen.has(current)) {
      console.error(`Warhammer DBC | фракции: цикл в дереве на ключе «${current}», цепочка оборвана`);
      break;
    }
    seen.add(current);
    chain.push(current);
    const next = parentOf(byKey.get(current));
    if (!next || !byKey.has(next)) break;
    current = next;
  }
  return chain;
}

/**
 * Глубина: 1 у корня, 2 у его детей и так далее. Ноль — фракции нет в карте.
 * Уровень нигде не хранится полем, он всегда считается отсюда — см. причину в
 * шапке module/data/item/faction.mjs.
 */
export function factionDepth(key, byKey) {
  return factionChain(key, byKey).length;
}

/**
 * ВСЕ фракции, под которые подпадает эта: она сама, её цепочка вверх по дереву
 * и то же самое для каждой дополнительной принадлежности.
 *
 * Дерево остаётся деревом, а вот отбор правил — нет: у Караула Смерти основная
 * линия ведёт к Адептус Астартес, а служба — к Ордо Ксенос и дальше к
 * Инквизиции, и правило обязано доставать его по обеим. Обход по посещённым:
 * дополнительные ссылки образуют не дерево, а сеть, и один и тот же предок
 * приходит по двум путям — а при ошибке в данных ещё и по кольцу.
 */
export function factionAncestors(key, byKey) {
  const seen = new Set();
  const queue = [String(key ?? "").trim()].filter(Boolean);
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current) || !byKey?.has?.(current)) continue;
    seen.add(current);
    const node = byKey.get(current);
    const next = parentOf(node);
    if (next) queue.push(next);
    queue.push(...factionAlsoKeys(node));
  }
  return seen;
}

/**
 * Подпадает ли `candidate` под `wanted`: это он сам, он ниже него по дереву
 * либо служит ему дополнительной принадлежностью.
 *
 * Это и есть правило отбора цели: Талант указывает на «Хаос», цель состоит в
 * «III роте», и ответ «да», потому что Хаос стоит в её цепочке предков.
 * Обратное неверно: Талант против роты не срабатывает на весь Хаос.
 */
export function isSameOrDescendant(candidate, wanted, byKey) {
  const want = String(wanted ?? "").trim();
  if (!want) return false;
  return factionAncestors(candidate, byKey).has(want);
}

/**
 * Подходит ли хоть одна фракция актора под искомую. Актор может состоять
 * сразу в нескольких (астартес-предатель — и Хаос, и свой легион), поэтому
 * на входе список.
 */
export function anySameOrDescendant(candidates = [], wanted, byKey) {
  return candidates.some(key => isSameOrDescendant(key, wanted, byKey));
}

/**
 * Фракции, входящие в эту напрямую — только следующая ступень, без внуков.
 * Обратная сторона `parentKey`: хранится ссылка вверх, а список вниз считается,
 * иначе одну связь пришлось бы держать в двух записях сразу.
 */
export function factionChildren(key, byKey) {
  const want = String(key ?? "").trim();
  if (!want) return [];
  return [...(byKey?.values?.() ?? [])]
    .filter(f => parentOf(f) === want)
    .sort(byName);
}

/**
 * Фракции, служащие этой дополнительной принадлежностью, — обратная сторона
 * `alsoIn`. В дерево они не входят и вассалами не считаются: Караул Смерти
 * стоит в составе Астартес, а в Инквизиции он служит.
 */
export function factionServants(key, byKey) {
  const want = String(key ?? "").trim();
  if (!want) return [];
  return [...(byKey?.values?.() ?? [])]
    .filter(f => factionAlsoKeys(f).includes(want))
    .sort(byName);
}

const byName = (a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "ru");

/**
 * Ключи фракций, в которых состоит актор. Фракция — обычный предмет на листе,
 * поэтому актор может состоять сразу в нескольких: астартес-предатель это и
 * Хаос, и свой легион.
 */
export function actorFactionKeys(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i?.type === "faction")
    .map(factionKey)
    .filter(Boolean);
}

// ── Ключ из названия ────────────────────────────────────────────────────────
//
// Ключ руками не пишут: его выдаёт система при создании Фракции, а поле на
// листе только показывает результат. Причина — ссылочная: на ключ смотрят
// `parentKey` других Фракций и цели Талантов, и правка ключа втихую разрывает
// эти ссылки, ничего не сообщая. Выданный однажды ключ не пересчитывается,
// даже когда Фракцию переименовали: подпись и идентификатор живут отдельно.

/** Кириллица в латиницу: одна буква может дать несколько (щ → sch). */
const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "",  ы: "y", ь: "",  э: "e", ю: "yu", я: "ya"
};

/** Длина ключа. Ограничение косметическое: длинный ключ нечитаем в ссылках. */
const KEY_MAX_LENGTH = 48;

/**
 * Ключ из названия: «Несущие Слово» → «nesuschie-slovo».
 *
 * @param {string} name     подпись Фракции
 * @param {Iterable<string>} taken уже занятые ключи — к повтору добавляется
 *   номер, потому что два узла с одним ключом означают потерянную ветку
 *   дерева (indexFactions оставит первый и пожалуется в консоль).
 * @returns {string} ключ; «faction» — если от названия ничего не осталось
 *   (пустое имя, одни знаки препинания, иероглифы).
 */
export function factionKeyFromName(name, taken = []) {
  const base = String(name ?? "")
    .toLowerCase()
    .split("")
    .map(ch => (Object.hasOwn(TRANSLIT, ch) ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, KEY_MAX_LENGTH)
    .replace(/-+$/, "") || "faction";

  const busy = new Set(taken);
  if (!busy.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!busy.has(candidate)) return candidate;
  }
}
