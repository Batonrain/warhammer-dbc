// module/rules/digitigrade.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Digitigrade (X) / Двусоставный (корбук, Трейты): «Ноги персонажа
//  двусоставные как у зверя, с пружинящей походкой. Он получает +Х к SPD
//  пешком и +5×Х на тесты Группирования» (wdbc-ird9n).
//
//  +X к SPD — запись Движения на самой Черте с формулой «rating»
//  (rules/mech-formula.mjs). Здесь — Группирование: отдельной области для него
//  у модификаторов нет, бонус прибавляется к тесту Acrobatics в окне Падения
//  (combat/movement-actions.mjs::_resolveFallDamage).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Суммарный рейтинг Двусоставного на акторе (0 — Черты нет). */
export function digitigradeRating(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i?.type === "trait" && (itemHasName(i, "Digitigrade") || itemHasName(i, "Двусоставный")))
    .reduce((sum, i) => sum + Math.max(1, Number(i.system?.rating) || 1), 0);
}

/** +5×X на тесты Группирования. */
export function digitigradeGroupingBonus(actor) {
  return 5 * digitigradeRating(actor);
}
