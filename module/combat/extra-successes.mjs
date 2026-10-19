// module/combat/extra-successes.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «+1 Успех на успешные тесты» от Черт, не зависящих от оружия: Бой Один На
//  Один (Палач, combat/single-combat.mjs — WS/S/A, пока на сцене ровно один
//  враг в контакте) и Искусный (Ренегат, rules/adroit.mjs — выбранная
//  Характеристика). Атаки и защита считают их сами (combat/attack.mjs,
//  defense.mjs, rules/kind-outcome.mjs); здесь — общий расчёт для приёмов
//  Борьбы и контактных приёмов, где степень берётся прямо из testOutcome
//  (wdbc-r3379).
// ════════════════════════════════════════════════════════════════════════════

import { singleCombatBonus } from "./single-combat.mjs";
import { adroitDegreeBonus } from "../rules/adroit.mjs";

/**
 * Сколько Успехов прибавить к степени успешного теста.
 * @param {Actor} actor
 * @param {{success:boolean, charKey:string}} test  charKey — характеристика теста (ws/s/ag/…)
 * @returns {number} 0 — прибавки нет (в т.ч. тест провален)
 */
export function extraSuccessDegrees(actor, { success, charKey } = {}, deps) {
  if (!success || !actor) return 0;
  const key = String(charKey ?? "").toLowerCase();
  return (Number(singleCombatBonus(actor, { success, charKey: key }, deps)) || 0)
       + (Number(adroitDegreeBonus(actor, key, success)) || 0);
}
