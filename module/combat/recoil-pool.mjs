// module/combat/recoil-pool.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Отскок» (стр. 12, wdbc-9wvm) — вместо нивеляции попаданий при успешном
//  Уклонении от СТРЕЛКОВОЙ атаки, персонаж может Отскочить на расстояние до
//  SPD м. Суммарная дистанция всех Отскоков ограничена SPD м за Раунд, а не
//  за одну атаку.
//
//  Хранится флагом на защищающемся (не полноценным schema-полем, как
//  actionPoints/reactions в _creature.mjs — Отскок нужен только этому модулю
//  и вкладке диалога защиты, заводить его в схему ради одного потребителя не
//  стоит; тот же выбор, что у флагов movedThisTurn/running,
//  module/combat/action-economy.mjs):
//    flags.warhammer-dbc.recoilPool = { spent: number, bonus: number }
//
//  Сбрасывается ИМПЕРАТИВНО в начале Хода актора — тем же тактом, что
//  resetActionEconomy (зовётся оттуда же), а не лениво по сравнению тега, как
//  evasion-pool.mjs: Отскок принадлежит самому защищающемуся (его
//  собственный ресурс на его собственный Ход), не паре защищающийся-
//  атакующий, поэтому сравнивать не с кем — обычный reset-по-такту, как у
//  ОД/Реакций.
//
//  bonus — доп. метры от непотраченных ОД в конце Хода актора (п.7 правила,
//  см. grantRecoilBonus) — прибавляются к пределу ТЕКУЩЕГО Раунда и
//  обнуляются вместе с spent при следующем сбросе (см. заголовок
//  resetRecoilPool). «Задержанное полудействие», которым книга разрешает
//  добирать эту же прибавку — в проекте такой механики нет вовсе (только
//  текст в constants/demon-weapon.mjs, не код), поэтому не читается здесь.
//
//  Вне активного Encounter экономика не считается вовсе (тот же принцип, что
//  у canSpendActionPoints/canSpendReaction) — Отскок «бесплатен».
// ════════════════════════════════════════════════════════════════════════

import { isEncounterActive, hasActionEconomy } from "./action-economy.mjs";
import { recoilItemBonus, recoilItemMultiplier } from "./recoil-item-bonuses.mjs";

const FLAG = "recoilPool";

/** SPD м (SPD×1) — module/combat/movement-actions.mjs использует то же поле. */
export function spdMeters(actor) {
  return Number(actor?.system?.movement?.halfMove) || 0;
}

function tracked(actor) {
  return isEncounterActive() && hasActionEconomy(actor);
}

/**
 * Предел дистанции Отскока в этом Раунде — (SPD + плоские бонусы предметов,
 * см. recoil-item-bonuses.mjs) × множитель (Malearius ×2), плюс накопленный
 * бонус ОД (п.7, не множится — см. заголовок recoilItemMultiplier).
 */
export function recoilLimit(actor) {
  const pool = actor?.getFlag?.("warhammer-dbc", FLAG);
  const base = (spdMeters(actor) + recoilItemBonus(actor)) * recoilItemMultiplier(actor);
  return base + (Number(pool?.bonus) || 0);
}

/** Сколько ещё можно отскочить в этом Раунде. Infinity вне боя — не считается. */
export function recoilRemaining(actor) {
  if (!tracked(actor)) return Infinity;
  const pool = actor?.getFlag?.("warhammer-dbc", FLAG);
  const spent = Number(pool?.spent) || 0;
  return Math.max(0, recoilLimit(actor) - spent);
}

/** Сброс в начале Хода актора — зовётся из resetActionEconomy. */
export async function resetRecoilPool(actor) {
  if (actor.getFlag("warhammer-dbc", FLAG)) {
    await actor.update({ "flags.warhammer-dbc.-=recoilPool": null });
  }
}

/**
 * Тратит дистанцию Отскока из пула этого Раунда — честно зажимает запрошенное
 * остатком, не позволяя уйти в минус. Возвращает реально потраченные метры.
 * Вне боя (tracked === false) списывать нечего — сам факт Отскока разыгран
 * текстом, пул не заводится.
 */
export async function spendRecoil(actor, meters) {
  const requested = Math.max(0, Number(meters) || 0);
  if (!tracked(actor)) return requested;
  const spend = Math.min(requested, recoilRemaining(actor));
  if (spend <= 0) return 0;
  const pool = actor.getFlag("warhammer-dbc", FLAG) || { spent: 0, bonus: 0 };
  await actor.setFlag("warhammer-dbc", FLAG, { ...pool, spent: (Number(pool.spent) || 0) + spend });
  return spend;
}

/**
 * Конец Хода (п.7): +SPD м к пределу Отскока в текущем Раунде за каждое
 * потраченное на это непотраченное ОД. Вызывающая сторона отвечает за то,
 * чтобы actionPoints реально были списаны (spendActionPoints) — эта функция
 * только прибавляет предел, деньгами не занимается.
 */
export async function grantRecoilBonus(actor, apSpent) {
  const bonus = Math.max(0, Number(apSpent) || 0) * spdMeters(actor);
  if (bonus <= 0) return 0;
  const pool = actor.getFlag("warhammer-dbc", FLAG) || { spent: 0, bonus: 0 };
  await actor.setFlag("warhammer-dbc", FLAG, { ...pool, bonus: (Number(pool.bonus) || 0) + bonus });
  return bonus;
}
