// module/combat/focused-wrath.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Сфокусированного Гнева (rules/focused-wrath.mjs): по карточке атаки
//  (flags.warhammer-dbc.attack) выясняет, усиливает ли Талант трату Очка Бесчестия на
//  эту атаку — «+10 за Очко» и «Переброс» в меню карточки (hooks.mjs).
//
//  Цель берётся по uuid, записанному в карточку в момент броска (attack.mjs): к моменту
//  клика по меню выделение на сцене уже могло смениться, а усиление относится к той цели,
//  по которой била ЭТА атака.
// ════════════════════════════════════════════════════════════════════════════

import { focusedWrathApplies } from "../rules/focused-wrath.mjs";

/**
 * @param {Actor} actor       кто тратит Очко (владелец Таланта)
 * @param {{targetUuid?:string}} atk  flags.warhammer-dbc.attack карточки
 * @param {boolean} isMelee   рукопашная ли атака этой карточки
 * @returns {Promise<boolean>}
 */
export async function focusedWrathOnAttack(actor, atk, isMelee) {
  if (!isMelee || !atk?.targetUuid) return false;
  let doc = null;
  try { doc = await globalThis.fromUuid?.(atk.targetUuid); } catch { doc = null; }
  const targetActor = doc?.actor ?? doc ?? null;
  return focusedWrathApplies(actor, { isMelee, targetActor });
}
