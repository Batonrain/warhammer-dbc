// module/rules/hard-target.mjs
// ════════════════════════════════════════════════════════════════════════
//  Hard Target / Трудная Цель (core, стр. 62; wdbc-1rno.30): «Когда
//  персонаж совершает Верховую Атаку, Натиск, или Бег, вся стрельба по нему
//  получает штраф –10 до начала его следующего Хода».
//
//  «Совершил в этом Ходу» — метка FAST_MOVE_FLAG в реестре меток до начала
//  следующего своего Хода (rules/turn-flags.mjs), её ставят HUD-кнопки Бега и
//  Натиска (combat/movement-actions.mjs) и бросок атаки с Базой «Натиск» или
//  «Верховая Атака» (sheets/attack/dialog.mjs). Отдельная метка, а не
//  system.meleeBase: База держится до следующей смены и Ходом не ограничена.
//
//  Гасители — те же, что у «Цель бежит» («штрафы за скорость цели»): свойство
//  Зенитное (стр. 166 называет Hard Target поимённо), успешный Прицел на
//  Упреждение и Предсказатель Движения при Прицеливании. Чистая логика.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

export const HARD_TARGET_CAPABILITY = "dodge.core.hardTarget";
export const FAST_MOVE_FLAG = "fastMoveThisTurn";
export const HARD_TARGET_PENALTY = -10;

const flag = (actor, key) =>
  actor?.getFlag?.("warhammer-dbc", key) ?? actor?.flags?.["warhammer-dbc"]?.[key];

/** Есть ли у актора Талант Трудная Цель. */
export function hasHardTarget(actor) {
  return [...(actor?.items ?? [])].some(i => itemIs(i, "talent", HARD_TARGET_CAPABILITY, "Hard Target"));
}

/**
 * Штраф Трудной Цели к этой атаке: 0 или −10.
 * @param {object} target  актор цели
 * @param {{isMelee?: boolean, speedPenaltyIgnored?: boolean}} [opts]
 *   speedPenaltyIgnored — у стрелка есть гаситель «штрафов за скорость цели».
 */
export function hardTargetPenalty(target, { isMelee = false, speedPenaltyIgnored = false } = {}) {
  if (isMelee || !target || !hasHardTarget(target)) return 0;
  if (!flag(target, FAST_MOVE_FLAG) && !flag(target, "running")) return 0;
  return speedPenaltyIgnored ? 0 : HARD_TARGET_PENALTY;
}
