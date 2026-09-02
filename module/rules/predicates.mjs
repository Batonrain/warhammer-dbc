// module/rules/predicates.mjs
//
// Реестр условий (`when`) для правил. Каждый предикат — чистая функция
// (actor, ctx, value) => boolean. Ни обращений к game/ui/canvas, ни бросков:
// иначе правило не проверить тестом без запуска Foundry, а ради этого всё и
// затевалось. Формат записи — docs/rules-format.md.

import { actorFactionKeys, anySameOrDescendant, isSameOrDescendant, getFactionIndex }
  from "./factions.mjs";

/** Значение условия к списку: строка считается списком из одного элемента. */
const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

const norm = s => String(s ?? "").trim().toLowerCase();

/**
 * Имена Талантов и Черт в системе двуязычные: «Gene-Seed / Геносемя».
 * Сравниваем по любой половине; специализация в скобках на конце
 * («Resistance (Cold)») при сравнении отбрасывается.
 *
 * Тем же сравнением область `power:<имя>` находит психосилу
 * (rules/resolve-test.mjs): имена сил двуязычны ровно так же, и правило «у
 * астартес Порицание бьёт иначе» не должно зависеть от того, какой половиной
 * имени его записали.
 */
export function itemHasName(item, wanted) {
  const w = norm(wanted);
  if (!w) return false;
  return norm(item?.name).split("/").some(part => {
    const p = part.trim();
    return p === w || p.replace(/\s*\([^)]*\)\s*$/, "").trim() === w;
  });
}

/**
 * Есть ли у актора Талант или Черта с каждым из перечисленных имён.
 *
 * Список означает «и», а не «или»: правило с двумя вариантами записывается
 * двумя правилами, а вот требование двух Талантов сразу иначе не выразить.
 *
 * Типы «talent» и «trait» намеренно не разделяются — так же ведёт себя
 * разборщик требований талантов (constants/talent-requirements.mjs), и правило
 * не должно молча не сработать из-за того, что содержимое записано Чертой.
 */
function hasNamed(actor, names) {
  const items = [...(actor?.items ?? [])];
  return list(names).every(name => items.some(
    i => (i?.type === "talent" || i?.type === "trait") && itemHasName(i, name)));
}

/**
 * Итоговый Размер актора: базовый `system.size` плюс вклад Черт `system.sizeMod`.
 * Лист кладёт сумму в `system.sizeTotal` (documents/actor.mjs), но у подставного
 * актора в тесте её может не быть, поэтому считаем сами.
 *
 * Экспортирована: тем же способом читает Размер cor.sizeToHit/core.sizeStealth
 * (rules/resolve-test.mjs, valueFrom.targetSize/selfSize) — второй копии
 * формулы заводить не стали.
 */
export function sizeOf(actor) {
  const sys = actor?.system ?? {};
  if (sys.sizeTotal != null) return Number(sys.sizeTotal) || 0;
  return (Number(sys.size) || 0) + (Number(sys.sizeMod) || 0) + (Number(sys.sizeModNoSpd) || 0);
}

// Силовая/аспектная броня — то же множество, что POWER_ARMOR_TYPES в
// combat/armor-mods.mjs; не импортируем оттуда, чтобы rules/ не тянуло
// зависимость на combat/ (предикаты обязаны жить без Foundry, а armor-mods.mjs
// уже завязан на живой актор).
const POWER_ARMOUR_TYPES = new Set(["power", "aspect"]);

function wearsPowerArmour(actor) {
  return (actor?.items ?? []).some(i =>
    i?.type === "armor" && i?.system?.equipped && POWER_ARMOUR_TYPES.has(i?.system?.armorType));
}

/**
 * Носит ли актор хоть один надетый предмет брони со свойством «Sealed /
 * Закрытая» (ARMOR_PROPERTIES.sealed, constants/items.mjs — «Защита от химии
 * на коже»). Свойства брони хранятся как плоский массив строк-ключей
 * (system.properties, в отличие от оружия — без рейтинга, см.
 * combat/armor-properties.mjs::resolveArmorProps), здесь читаются напрямую
 * без импорта того модуля — тот уже завязан на combat/, а предикаты обязаны
 * жить без Foundry (см. комментарий у wearsPowerArmour выше).
 */
function wearsSealedArmour(actor) {
  return (actor?.items ?? []).some(i =>
    i?.type === "armor" && i?.system?.equipped &&
    (i?.system?.properties ?? []).includes("sealed"));
}

/**
 * Сус-ан Мембрана — орган Геносемени Гвардии Ворона/Призраков Смерти
 * (wdbc-l07y, дубль был в rules/death-save.mjs и apps/sus-an-heal.mjs).
 * Русская половина в паке несёт книжный номер («12. Сус-ан Мембрана /
 * Sus-an Membrane») — itemHasName сравнивает половины ЦЕЛИКОМ, поэтому номер
 * сломал бы совпадение по русской половине; проверяем обе половины
 * отдельно, а не одну надёжную (английскую) — старые фикстуры тестов и
 * возможные ручные записи без номера остаются рабочими.
 */
export function isSusAnMembraneItem(item) {
  return item?.type === "implant" &&
    (itemHasName(item, "Сус-ан Мембрана") || itemHasName(item, "Sus-an Membrane"));
}

/** Хирургически установленный (не просто лежащий в инвентаре) имплант с этим именем. */
function hasInstalledImplant(actor, name) {
  return (actor?.items ?? []).some(i => i?.type === "implant" && itemHasName(i, name) &&
    i?.flags?.["warhammer-dbc"]?.installed && !i?.flags?.["warhammer-dbc"]?.disabled);
}

/**
 * Состоит ли актор в каждой из перечисленных фракций — считая нижестоящие.
 * Персонаж из III роты Несущих Слово подходит под условие «Хаос».
 *
 * Список означает «и», как у hasTalent/hasTrait: правило с альтернативами
 * пишется двумя правилами, а требование двух принадлежностей сразу иначе не
 * выразить.
 */
function inFactions(actor, wanted) {
  const mine = actorFactionKeys(actor);
  const byKey = getFactionIndex();
  return list(wanted).every(key => anySameOrDescendant(mine, key, byKey));
}

export const PREDICATES = {
  race:    (actor, ctx, value) => list(value).includes(actor?.system?.race),
  subrace: (actor, ctx, value) => list(value).includes(actor?.system?.subrace),

  // Легион Геносемени (module/constants/legions.mjs, id — римская цифра, "VIII"
  // у Повелителей Ночи). Раса «astartes» одна на всех легионов, поэтому
  // легионные Таланты (папка пикера «Повелители Ночи») не выразить условием
  // `race` — нужен отдельный ключ (item-picker.mjs::talentGroupLock, wdbc-sauo).
  geneSeedLegion: (actor, ctx, value) => list(value).includes(actor?.system?.geneSeed?.legion),

  // Пси-Рейтинг не ниже указанного — общее условие книги (папки пикера
  // «Псайкер»/«Псайкана», wdbc-sauo), было в справочнике нереализованным
  // с самого этапа 1 плана.
  psyRatingMin: (actor, ctx, value) => (Number(actor?.system?.psyker?.rating) || 0) >= Number(value),

  sizeMax: (actor, ctx, value) => sizeOf(actor) <= Number(value),

  // В Ярости (system.inRage, тот же флаг, что читает weapon-properties.mjs
  // для weaponPropertyImmunityInRage) — простой тумблер, не полная механика
  // Ярости (wdbc-wyr3).
  inRage: (actor) => !!actor?.system?.inRage,

  // Носит ли надетую броню со свойством «Sealed / Закрытая» — шестой гейт
  // Механики (when.requireSealedArmour/negateSealedArmour, mech-when.mjs,
  // wdbc-1rno: «без гермодоспеха» у Миазм и подобных).
  wearsSealedArmour,

  // Уровень Ранения (documents/actor.mjs, rules/wound-tier.mjs): healthy/light/
  // heavy/dying, тот же ключ, что подписан в блоке РАНЫ на листе. Список — «в
  // списке», как у race/subrace/weaponClass: правило «Тяжело раненный или
  // хуже» пишется woundTier: ["heavy", "dying"].
  woundTier: (actor, ctx, value) => list(value).includes(actor?.system?.wounds?.tier),

  charMin: (actor, ctx, value) => Object.entries(value ?? {}).every(
    ([key, min]) => (Number(actor?.system?.characteristics?.[key]?.total) || 0) >= min),

  hasTalent: (actor, ctx, value) => hasNamed(actor, value),
  hasTrait:  (actor, ctx, value) => hasNamed(actor, value),

  weaponClass: (actor, ctx, value) => list(value).includes(ctx?.weapon?.system?.weaponClass),

  // Актор цели лежит в ctx.targetActor, а не в ctx.target: в контексте броска
  // (rules/match-context.mjs) имя `target` занято флагом «бросок нацелен», и на
  // этапе 2 плана оба контекста сошлись в одном объекте.
  targetHasTrait: (actor, ctx, value) => hasNamed(ctx?.targetActor, value),

  // Противоположность targetHasTrait по состояниям, не по Чертам: «нет ни
  // одного из перечисленных состояний X» (ключи — CONDITIONS_DEF в
  // sheets/sheet-helpers.mjs, напр. "stunned"/"helpless"). Список — не «и»,
  // как у hasTalent, а поэлементное «нет», иначе «Оглушён ИЛИ Беспомощен» было
  // бы не выразить одним условием. Нужна как есть, а не через отрицание в
  // данных — `when` в rules/collect.mjs требует ото ВСЕХ условий true разом
  // (AND), готового «not» нет, поэтому отрицание зашито в саму функцию.
  targetLacksCondition: (actor, ctx, value) =>
    list(value).every(key => !ctx?.targetActor?.system?.conditions?.[key]),

  // Ненулевой Размер — гейт core.sizeToHit/core.sizeStealth (rules/library/
  // core.mjs): без него строка с «(+0)» лезла бы в чек-лист на каждом броске
  // против обычного человека, а не только там, где Размер реально что-то даёт.
  hasSize:       (actor, ctx) => sizeOf(actor) !== 0,
  targetHasSize: (actor, ctx) => sizeOf(ctx?.targetActor) !== 0,

  // «Позволяет сохранять Трейт Nimble в силовой броне» (имплант «Чёрный
  // Панцирь / Black Carapace», DoomBC — ГЕНОСЕМЯ) — без брони условие не
  // проверяется вовсе, Проворный сам по себе Чёрного Панциря не требует.
  targetKeepsNimbleInArmour: (actor, ctx) => {
    const t = ctx?.targetActor;
    if (!wearsPowerArmour(t)) return true;
    return hasInstalledImplant(t, "Black Carapace");
  },

  // Принадлежность к фракции — своя и у цели. Обе считают нижестоящие: условие
  // «Хаос» подходит и роте в составе его легиона, обратное неверно.
  hasFaction: (actor, ctx, value) => inFactions(actor, value),

  // У социального теста цели-токена нет вовсе: фракцию собеседника игрок
  // выбирает в диалоге, и она приезжает в ctx.socialFaction одним ключом.
  // Поэтому смотрим сначала туда, и только потом на выделенного актора.
  targetHasFaction: (actor, ctx, value) => {
    const byKey = getFactionIndex();
    if (ctx?.socialFaction)
      return list(value).every(key => isSameOrDescendant(ctx.socialFaction, key, byKey));
    return inFactions(ctx?.targetActor, value);
  },

  // Avatar of Slaughter/Аватар Резни (wdbc-sk8s): цель провалила тест W−10
  // против Берсерка → до конца боя −20 на атаки/манёвры, НЕ направленные на
  // него. Метка — на самом акторе (module/combat/avatar-of-slaughter.mjs),
  // читается здесь, а не через cross-actor источник (в отличие от Adjutant):
  // условие целиком про самого актора и то, кого он сейчас атакует.
  avatarOfSlaughterOffTarget: (actor, ctx) => {
    const mark = actor?.getFlag?.("warhammer-dbc", "avatarOfSlaughterMark");
    if (!mark?.berserkerUuid) return false;
    return ctx?.targetActor?.uuid !== mark.berserkerUuid;
  }
};

/**
 * Элитный архетип у актора — тремя источниками: строка в шапке
 * (`system.eliteArchetype`), список дополнительных (`eliteArchetypesExtra`)
 * или предмет типа eliteArchetype. Архетип бывает и предметом (куплен
 * пикером), и строкой (вписан руками/со старого листа) — обе формы отпирают
 * одно и то же. Раньше жил копиями в character-context и item-picker.
 *
 * `name` принимает и одну половину («Феларх»), и полное двуязычное имя
 * («Felarch / Феларх»): совпадение любой половины искомого с любой половиной
 * источника достаточно — старые архетипы записаны только русской половиной,
 * новые полным именем, и обе формы встречаются с обеих сторон сверки
 * (wdbc-91o8). Служебный префикс [WIP] у имени при сверке отбрасывается.
 */
export function hasEliteArchetype(actor, name) {
  const wanted = String(name ?? "").split("/").map(s => s.trim()).filter(Boolean);
  if (!wanted.length) return false;
  const sys = actor?.system || {};
  const sources = [
    sys.eliteArchetype,
    ...(sys.eliteArchetypesExtra || []),
    ...[...(actor?.items ?? [])].filter(i => i?.type === "eliteArchetype").map(i => i?.name)
  ].map(n => ({ name: String(n ?? "").replace(/^\[WIP\]\s*/, "") }));
  return wanted.some(w => sources.some(src => itemHasName(src, w)));
}

/**
 * Одержимый (DoomBC_Core 129-132): ручной чекбокс Хаосита ЛИБО Элитный
 * архетип «Одержимый». Один предикат на вкладку листа и на гейт папки
 * «Таланты одержимых» в пикере — иначе вкладка открыта, а Дары не купить.
 */
export function isPossessed(actor) {
  const sys = actor?.system || {};
  return (sys.alignment === "heretic" && !!sys.possessed) || hasEliteArchetype(actor, "Одержимый");
}

/**
 * Дары Одержимого (module/constants/possession.mjs::POSSESSION_GIFTS) —
 * предметы-таланты с двуязычным именем «Английское / Дар: Русское» (wdbc-rc5z).
 * Раньше этот префикс был договором между rules/character.mjs (точное
 * совпадение ВСЕЙ строки имени с «Дар: X» — не срабатывало на реальные
 * бигвальные записи пака) и sheets/tabs/possession.mjs (name.startsWith,
 * та же ошибка — реальное имя начинается с английской половины, не с
 * префикса), закреплён только комментариями в двух местах.
 */
export const GIFT_NAME_PREFIX = "Дар: ";

/** Множество активных имён Даров (без префикса) — предметы-таланты актора. */
export function giftNamesOf(actor) {
  const out = new Set();
  for (const i of actor?.items ?? []) {
    if (i?.type !== "talent") continue;
    for (const part of String(i?.name ?? "").split("/")) {
      const p = part.trim();
      if (p.startsWith(GIFT_NAME_PREFIX)) { out.add(p.slice(GIFT_NAME_PREFIX.length).trim()); break; }
    }
  }
  return out;
}
