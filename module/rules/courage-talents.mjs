// module/rules/courage-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты «Смелость» главы 3 (корбук): Пожарный, Бесстрашный, Пресыщенный,
//  Идолопоклонник — имена возможностей и числа. Чистый файл без импортов: его
//  читают и боевые модули, и лист, и источник правил, поэтому цикл импортов
//  (test/rules/source-registry-acyclic.test.mjs) он замкнуть не может.
//
//  Где что работает:
//   • Пожарный (Sahara 3-scope) — combat/condition-ticks.mjs::rollBurningPanicTest
//     (не паникует от Горения) и combat/extinguish.mjs (+30 на тушение);
//   • Бесстрашный / Идолопоклонник — автопроход Морали, rules/morale-auto.mjs;
//   • Пресыщенный — галочка «Земной ужас» в окне Страха, sheets/tabs/disorders.mjs
//     → combat/fear.mjs (properties.mundaneHorror).
// ════════════════════════════════════════════════════════════════════════════

export const FEARLESS_CAP  = "courage.core.fearless";
export const FIREMAN_CAP   = "courage.core.fireman";
export const JADED_CAP     = "courage.core.jaded";
export const IDOLATER_CAP  = "courage.core.idolater";

/** Пожарный: «+30 на тесты тушения себя или других». */
export const FIREMAN_EXTINGUISH_BONUS = 30;

/** Идолопоклонник: «штраф –30 на встречные броски против Команд и социального взаимодействия кумира». */
export const IDOLATER_OPPOSED_PENALTY = -30;

/**
 * Галочка «кумир рядом» — состояние носителя Идолопоклонника (system.idolNearby).
 * Кумир — не привязка к актору (у Эльдар это целая группа, constants/aeldari-
 * origins.mjs), поэтому просто флаг; сбрасывается вручную.
 */
export function isIdolNearby(actor) {
  return !!actor?.system?.idolNearby;
}
