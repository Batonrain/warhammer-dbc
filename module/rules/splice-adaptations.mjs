// module/rules/splice-adaptations.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Адаптации Сплайса (Основная книга, «Отродия → Сплайс»).
//
//  Gene-Splice: «выбирает по одной адаптации из трех списков далее. Он может
//  выбрать дополнительные адаптации (из основных списков или продвинутые),
//  теряя +5% опыта от Трейта Fast Learner за каждую (максимум +3
//  дополнительные адаптации)».
//  Unstable Genome: «Каждый раз, когда Сплайс получает урон в Характеристики,
//  он увеличивает этот урон на +1 и еще на +1 за каждую дополнительную
//  адаптацию».
//
//  Каждая адаптация — отдельная Черта пака (packs-src/traits/Трейты_рас/
//  Адаптации_Сплайса/) с меткой flags.warhammer-dbc.spliceAdaptation =
//  "sensory"|"defensive"|"offensive"|"advanced". Метка, а не имя: «Амфибия»
//  адаптации и Черта Amphibious, которую она выдаёт, — разные предметы.
//
//  Какая из взятых адаптаций «дополнительная», не хранится: книга требует
//  ровно три обязательных (по одной из трёх списков), значит всё сверх трёх —
//  дополнительное, откуда бы ни взялось. Продвинутые берутся только как
//  дополнительные, и на счёт это не влияет.
//
//  Читатели: rules/character.mjs (system.fastLearnerBonus — процент «Ловит на
//  Лету») и combat/char-damage.mjs (единая точка урона в Характеристики).
//  Модуль чистый — ни Foundry, ни game.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const SPLICE_ADAPTATION_FLAG = "spliceAdaptation";

/** Сколько адаптаций обязательны (по одной из Сенсорных, Защитных, Атакующих). */
export const SPLICE_REQUIRED_ADAPTATIONS = 3;
/** Потолок дополнительных адаптаций. */
export const SPLICE_MAX_EXTRA_ADAPTATIONS = 3;
/** Сколько процентов «Ловит на Лету» теряет каждая дополнительная. */
export const FAST_LEARNER_PER_EXTRA = 5;

const itemsOf = actor => {
  const items = actor?.items;
  if (!items) return [];
  return Array.isArray(items) ? items : [...items];
};

/** Черта-адаптация Сплайса (по метке пака). */
export function isSpliceAdaptation(item) {
  if (item?.type !== "trait") return false;
  const flag = typeof item.getFlag === "function"
    ? item.getFlag("warhammer-dbc", SPLICE_ADAPTATION_FLAG)
    : item.flags?.["warhammer-dbc"]?.[SPLICE_ADAPTATION_FLAG];
  return !!flag;
}

/** Сколько адаптаций у актора всего. */
export function spliceAdaptationCount(actor) {
  return itemsOf(actor).filter(isSpliceAdaptation).length;
}

/** Сколько из них дополнительных: всё сверх трёх, не больше трёх. */
export function spliceExtraAdaptations(actor) {
  const extra = spliceAdaptationCount(actor) - SPLICE_REQUIRED_ADAPTATIONS;
  return Math.max(0, Math.min(SPLICE_MAX_EXTRA_ADAPTATIONS, extra));
}

/** Процент «Ловит на Лету» после дополнительных адаптаций (не ниже 0). */
export function fastLearnerWithAdaptations(rating, extras) {
  const r = Number(rating) || 0;
  return Math.max(0, r - FAST_LEARNER_PER_EXTRA * Math.max(0, Number(extras) || 0));
}

/**
 * Надбавка Нестабильного Генома к каждому урону в Характеристики:
 * 0 без Черты, иначе 1 + число дополнительных адаптаций.
 */
export function unstableGenomeBonus(actor) {
  const items = itemsOf(actor);
  const has = items.some(i => i?.type === "trait"
    && (itemHasName(i, "Unstable Genome") || itemHasName(i, "Нестабильный Геном")));
  return has ? 1 + spliceExtraAdaptations(actor) : 0;
}
