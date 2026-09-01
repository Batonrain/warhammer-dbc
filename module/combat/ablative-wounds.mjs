// module/combat/ablative-wounds.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Аблативные Раны (wdbc-smy7, напр. Дар Нургла «Абсурдно Толстый»: «+10
//  аблативных Ран... автовосстановление 1 аблативной Раны за Ход»). Пул сам
//  (system.wounds.ablative/.ablativeMax) и поглощение урона — в
//  module/rules/wounds.mjs; здесь только регенерация, тем же приёмом, что
//  Призма (module/combat/prisma.mjs) — +1/Ход из hooks.mjs::updateCombat,
//  рядом с resetActionEconomy/processPrismaTurnStart.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * +1 к текущим Аблативным Ранам актора в начале его Хода, до ablativeMax.
 * Нет пула (ablativeMax <= 0) — не трогает актора вовсе.
 */
export async function processAblativeWoundsTurnStart(actor) {
  const max = Number(actor?.system?.wounds?.ablativeMax) || 0;
  if (max <= 0) return;
  const cur = Number(actor.system.wounds.ablative) || 0;
  if (cur < max) await actor.update({ "system.wounds.ablative": Math.min(max, cur + 1) });
}
