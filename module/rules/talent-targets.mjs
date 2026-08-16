// module/rules/talent-targets.mjs
//
// Цели Таланта — против кого он работает: Hatred, Peer, Enemy, Good Reputation.
// Здесь только форма записи и её сборка; проверка «подходит ли цель броска»
// живёт в предикатах (module/rules/predicates.mjs) и опирается на дерево
// фракций (module/rules/factions.mjs).
//
// Целей у одного Таланта может быть несколько, и они разной природы: книга
// пишет «Hatred (Dark Mechanicum, Adeptus Mechanicus, Vehicles)» одной
// записью, где два первых — фракции, а третье вообще не фракция, а тип
// актора. Поэтому цель это не ссылка, а помеченный вид.
//
// Foundry здесь не нужен: на вход идут либо литералы, либо уже прочитанные
// поля документа, и всё проверяется тестом без заглушки.

import { isSameOrDescendant, anySameOrDescendant, actorFactionKeys, getFactionIndex }
  from "./factions.mjs";

/** Виды цели и их подписи для интерфейса. */
export const TARGET_KINDS = {
  faction:   "Фракция",
  race:      "Раса",
  feature:   "Признак",
  patron:    "Покровительство",
  actorType: "Тип существа",
  all:       "Все!"
};

/** Значение цели-покровительства «всё равно чьё, лишь бы было». */
export const PATRON_ANY = "any";

/**
 * Кому существо покровительствуется. Поле разное у разных типов, и это не
 * прихоть: у Демона и Принца покровитель есть всегда (`allegiance`), а у
 * персонажа он значит что-то только при хаоситском мировоззрении — в схеме
 * `patronGod` по умолчанию стоит «Неделимый» у КАЖДОГО, включая лоялиста, и
 * без этой оговорки Ненависть к Неделимому срабатывала бы на всю Гвардию.
 *
 * @returns {string} ключ бога либо пустая строка, если покровителя нет.
 */
export function actorPatronKey(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.allegiance ?? (sys.alignment === "heretic" ? sys.patronGod : "");
  return String(raw ?? "").trim();
}

/**
 * Признаки существа, по которым книга тоже нацеливает Ненависть и Связи:
 * «Hatred (Psykers)» — не про организацию и не про породу, а про свойство.
 *
 * Реестр, а не перечисление в коде отбора: новый признак заводится строкой
 * здесь и сразу появляется и в диалоге выбора, и в проверке. Проверка —
 * чистая функция от актора, потому что цели отбираются там же, где правила, и
 * обязаны работать без запуска Foundry.
 */
export const TARGET_FEATURES = {
  psyker:      { label: "Псайкер",           test: a => !!a?.system?.isPsyker },
  possessed:   { label: "Одержимый",         test: a => !!a?.system?.possessed },
  techpriest:  { label: "Техножрец",         test: a => !!a?.system?.isTechpriest },
  rogueTrader: { label: "Вольный торговец",  test: a => !!a?.system?.isRogueTrader }
};

/** Пустая цель нужного вида — остальные поля добираются ниже. */
const blank = kind => ({ kind, ref: "", value: "", name: "", img: "" });

/**
 * Цель-фракция из предмета фракции (документ Foundry либо литерал теста).
 * Ключ — то, чем фракция названа в дереве; подпись и значок запоминаются на
 * момент выбора, чтобы лист не загружал предмет ради имени.
 *
 * @returns {?object} null, если у фракции нет ключа: ссылаться не на что.
 */
export function factionTarget(faction) {
  const ref = String(faction?.system?.key ?? faction?.key ?? "").trim();
  if (!ref) return null;
  return {
    ...blank("faction"),
    ref,
    name: String(faction?.name ?? ref),
    img:  String(faction?.img ?? "")
  };
}

/** Цель-тип актора: техника фракцией не является и деревом не описывается. */
export function actorTypeTarget(type, label = "") {
  const value = String(type ?? "").trim();
  if (!value) return null;
  return { ...blank("actorType"), value, name: String(label || value) };
}

/**
 * Цель-раса: ненависть бывает не к организации, а к породе.
 *
 * Книга пишет так прямо — «Hatred (Наги)» у Гарпии, — и фракцией это не
 * выразить: наг не вступает в наг, он ими рождается. Принадлежность живёт
 * предметом и её можно снять, раса стоит полем на листе и держится за
 * персонажа сама.
 *
 * Ключ берётся общий и для расы, и для субрасы: списки не пересекаются
 * (constants/races.mjs), а «Ненависть к Париям» — такое же законное правило
 * книги, как «Ненависть к Нагам», и заводить ради него второй вид цели незачем.
 */
export function raceTarget(key, label = "") {
  const value = String(key ?? "").trim();
  if (!value) return null;
  return { ...blank("race"), value, name: String(label || value) };
}

/**
 * Цель-признак: свойство существа, а не его происхождение или подчинение.
 * Незнакомый ключ целью не становится — иначе правило молча не срабатывало бы,
 * а виноватой выглядела бы механика отбора.
 */
export function featureTarget(key) {
  const value = String(key ?? "").trim();
  const def = TARGET_FEATURES[value];
  if (!def) return null;
  return { ...blank("feature"), value, name: def.label };
}

/**
 * Цель-покровительство: против тех, кто служит Губительным Силам.
 *
 * Книга нацеливает Ненависть прямо на бога — «Hatred (Khorne)», — и это не
 * фракция: кхорнит из легиона-предателя и кхорнит-культист не состоят вместе
 * нигде, кроме самого покровительства. Ключ `any` означает «любой покровитель»:
 * есть — значит подходит.
 */
export function patronTarget(key, label = "") {
  const value = String(key ?? "").trim();
  if (!value) return null;
  const name = label || (value === PATRON_ANY ? "Любой покровитель" : value);
  return { ...blank("patron"), value, name: String(name) };
}

/** «Все!» — вариант Hatred без разбора, кого именно. */
export function allTarget() {
  return { ...blank("all"), name: TARGET_KINDS.all };
}

/** Одна и та же цель? Сравнение по сути, а не по подписи: имя правится в UI. */
export function sameTarget(a, b) {
  if (a?.kind !== b?.kind) return false;
  if (a.kind === "faction") return a.ref === b.ref;
  if (["actorType", "race", "feature", "patron"].includes(a.kind)) return a.value === b.value;
  return true;                       // «Все!» бывает только одно
}

/**
 * Добавляет цель, не плодя повторов. Повтор — не ошибка данных, а обычный
 * промах мышью, поэтому молча возвращаем список как есть.
 *
 * @returns {object[]} НОВЫЙ список: исходный не меняется.
 */
export function addTarget(targets = [], target) {
  if (!target) return [...targets];
  if (targets.some(t => sameTarget(t, target))) return [...targets];
  return [...targets, target];
}

/** Убирает цель по номеру. Номер вне списка ничего не меняет. */
export function removeTargetAt(targets = [], index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= targets.length) return [...targets];
  return targets.filter((_, n) => n !== i);
}

/** Подпись цели для листа и чата. */
export function targetLabel(target) {
  if (!target) return "";
  if (target.kind === "all") return TARGET_KINDS.all;
  return target.name || target.ref || target.value || "?";
}

/** Ключи фракций среди целей — то, с чем работает дерево на отборе. */
export function factionRefs(targets = []) {
  return targets.filter(t => t?.kind === "faction").map(t => t.ref).filter(Boolean);
}

/**
 * Подходит ли цель Таланта к текущему броску.
 *
 * У фракции два пути, и они не пересекаются:
 *
 *   в бою цель — это выделенный токен, и его фракции лежат предметами на
 *   акторе (ctx.targetActor);
 *   в социальном тесте токена нет вовсе — «Инквизицию» не выделишь мышью, —
 *   поэтому игрок выбирает фракцию собеседника в диалоге, и она приезжает в
 *   ctx.socialFaction одним ключом.
 *
 * Отбор односторонний, как и всё дерево: Ненависть к Хаосу срабатывает на роту
 * в его составе, Ненависть к роте на весь Хаос — нет.
 *
 * @param {object} target  запись из system.targets Таланта
 * @param {object} ctx     контекст броска (rules/resolve-test.mjs)
 * @param {Map}    byKey   дерево фракций; по умолчанию — реестр
 */
export function targetMatches(target, ctx = {}, byKey = getFactionIndex()) {
  if (!target) return false;
  if (target.kind === "all") return true;
  if (target.kind === "actorType") return ctx?.targetActor?.type === target.value;
  // Раса и субраса — два поля листа, ключи в них из разных списков, поэтому
  // одна цель проверяет оба: «Ненависть к Нагам» и «Ненависть к Париям»
  // записываются одинаково.
  if (target.kind === "race") {
    const sys = ctx?.targetActor?.system ?? {};
    return sys.race === target.value || sys.subrace === target.value;
  }
  if (target.kind === "feature") {
    return !!TARGET_FEATURES[target.value]?.test(ctx?.targetActor);
  }
  if (target.kind === "patron") {
    const patron = actorPatronKey(ctx?.targetActor);
    if (!patron) return false;
    return target.value === PATRON_ANY || target.value === patron;
  }
  if (target.kind !== "faction") return false;

  if (ctx?.socialFaction) return isSameOrDescendant(ctx.socialFaction, target.ref, byKey);
  return anySameOrDescendant(actorFactionKeys(ctx?.targetActor), target.ref, byKey);
}

/** Сработала ли хоть одна цель Таланта: цели в списке соединены через «или». */
export function anyTargetMatches(targets = [], ctx = {}, byKey = getFactionIndex()) {
  return targets.some(t => targetMatches(t, ctx, byKey));
}
