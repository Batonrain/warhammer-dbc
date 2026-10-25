// module/rules/unholy-devotion.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Unholy Devotion / Нечестивая Преданность (корбук стр. 113, Таланты «Миньоны»;
//  Sahara 3-cross-actor, решение 24.10.2026):
//
//  «Когда персонаж получает попадание, любой из его Миньонов, находящихся на
//  расстоянии не более Полудвижения, может пройти тест на A+0 и получить попадание
//  вместо персонажа. Миньоны, находящиеся не более 2м от персонажа, получают +30
//  на этот тест. Каждый Миньон может попытаться принять на себя удар только один
//  раз в Раунд.»
//
//  Чистые числа без Foundry. Геометрия и бросок — combat/unholy-devotion.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const UNHOLY_DEVOTION_CAP = "minion.core.unholyDevotion";

/** «Не более 2м от персонажа» — +30 на тест. */
export const NEAR_RANGE_M = 2;
export const NEAR_BONUS = 30;

/** Флаг «раз в Раунд» на Миньоне (rules/cooldown.mjs, unit "round"). */
export const UNHOLY_DEVOTION_USE_FLAG = "unholyDevotionTry";

/** Достаёт ли Миньон: расстояние не больше его Полудвижения (метры сцены). */
export function devotionInReach(halfMove, distance) {
  const reach = measure(halfMove);
  const d = measure(distance);
  return reach != null && d != null && reach > 0 && d <= reach;
}

/** +30 на тест, если Миньон не дальше 2м от персонажа. */
export function devotionBonus(distance) {
  const d = measure(distance);
  return d != null && d <= NEAR_RANGE_M ? NEAR_BONUS : 0;
}

/** Число или null: Number(null) === 0 принял бы «расстояние неизвестно» за «вплотную». */
function measure(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Порог теста A+0 (+30 вблизи). */
export function devotionThreshold(ag, distance) {
  return (Number(ag) || 0) + devotionBonus(distance);
}

/** Миньон ли этот актор данного Хозяина. */
export function isMinionOf(minion, master) {
  return minion?.type === "minion" && !!master?.uuid && minion.system?.masterUuid === master.uuid;
}
