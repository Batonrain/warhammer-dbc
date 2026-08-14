// module/rules/factions.mjs
//
// Дерево принадлежностей: разбор ссылок `parent` между Фракциями
// (module/data/item/faction.mjs). Ненависть к Хаосу достаёт и роту в составе
// его легиона, поэтому «подходит ли цель» — это вопрос «лежит ли её фракция в
// поддереве той, что указана в Таланте».
//
// Здесь только чистые функции: ни game, ни ui, ни fromUuid. Отсюда и решение
// хранить в `parent` КЛЮЧ, а не UUID — разрешение uuid асинхронно и тянет за
// собой Foundry, и предикаты (rules/predicates.mjs) перестали бы проверяться
// тестом без запуска игры.
//
// Вход везде одинаковый: `byKey` — обычная карта «ключ → фракция», где у
// фракции есть `system.parent` (или просто `parent`, если это литерал теста).

/** Ключ родителя у записи любого вида: предмет Foundry либо литерал теста. */
function parentOf(faction) {
  return String(faction?.system?.parent ?? faction?.parent ?? "").trim();
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
 * Совпадает ли `candidate` с `wanted` или лежит ниже него в дереве.
 *
 * Это и есть правило отбора цели: Талант указывает на «Хаос», цель состоит в
 * «III роте», и ответ «да», потому что Хаос стоит в её цепочке предков.
 * Обратное неверно: Талант против роты не срабатывает на весь Хаос.
 */
export function isSameOrDescendant(candidate, wanted, byKey) {
  const want = String(wanted ?? "").trim();
  if (!want) return false;
  return factionChain(candidate, byKey).includes(want);
}

/**
 * Подходит ли хоть одна фракция актора под искомую. Актор может состоять
 * сразу в нескольких (астартес-предатель — и Хаос, и свой легион), поэтому
 * на входе список.
 */
export function anySameOrDescendant(candidates = [], wanted, byKey) {
  return candidates.some(key => isSameOrDescendant(key, wanted, byKey));
}
