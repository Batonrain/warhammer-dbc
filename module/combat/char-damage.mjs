// module/combat/char-damage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Единая точка урона в Характеристики (wdbc-x1nz.2.83). Раньше каждый
//  источник (Гангрена, радиация, Лучевая болезнь, Soulfire, руна Сигиллита,
//  Прижигание) сам вычитал из ручного «Мод.» system.charDamage — без пола 0,
//  без восстановления и без смерти от нулевой T.
//
//  Здесь: пишется system.charLoss (rules/char-loss.mjs — пол 0, отсчёт
//  восстановления), T = 0 — смерть (combat/condition-death.mjs). Остальные
//  эффекты нулевой Характеристики производные (rules/character.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { charLossAddFields, charLossHealFields, charLossPortionsAddFields, actorRecoveryPolicy } from "../rules/char-loss.mjs";
import { killByCondition } from "./condition-death.mjs";

/**
 * Нанести урон в Характеристику.
 * @param {Actor}  actor
 * @param {string} key     ws|bs|s|t|ag|int|per|wp|fel|inf
 * @param {number} amount  сколько урона (не поглощается)
 * @param {object} [opts]
 * @param {object} [opts.extra]  доп. поля в тот же actor.update (флаги таймеров источника)
 * @param {number} [opts.at]     момент (worldTime) для отсчёта восстановления
 * @param {string} [opts.cause]  причина смерти при T ≤ 0 (rules/death-save.mjs::DEATH_CAUSE_FLAG)
 * @param {?object} [opts.portion] урон со своим темпом (task 1-8): { hours (0 —
 *   перманентный), until, source, noMagic } — отдельной порцией, не в общий charLoss
 * @returns {Promise<{applied: number, before: number, after: number, died: boolean}>}
 */
export async function applyCharDamage(actor, key, amount, { extra = {}, at = globalThis.game?.time?.worldTime ?? 0, cause = "toughness", portion = null } = {}) {
  let patch, applied;
  const before = Number(actor.system?.characteristics?.[key]?.total) || 0;
  if (portion) {
    const r = charLossPortionsAddFields(actor.system, [{ ...portion, key, amount }], at);
    patch = r.patch; applied = r.applied[key] || 0;
  } else {
    // Период восстановления по политике актора (болезни, Конструктор) — для
    // первого отсчёта.
    const hours = actorRecoveryPolicy(actor)?.[key]?.hours;
    ({ patch, applied } = charLossAddFields(actor.system, key, amount, at, hours));
  }
  const after = before - applied;
  const upd = { ...patch, ...extra };
  if (Object.keys(upd).length) await actor.update(upd);
  let died = false;
  if (key === "t" && applied > 0 && after <= 0) died = await killByCondition(actor, cause);
  return { applied, before, after, died };
}

/**
 * Восстановить урон в Характеристику (лечение, Таланты, эликсиры).
 * @returns {Promise<number>} сколько восстановлено
 */
export async function healCharDamage(actor, key, n) {
  const { patch, healed } = charLossHealFields(actor.system, key, n);
  if (healed) await actor.update(patch);
  return healed;
}
