// module/combat/ablative-wounds.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Аблативные Раны (wdbc-smy7, напр. Дар Нургла «Абсурдно Толстый»: «+10
//  аблативных Ран... автовосстановление 1 аблативной Раны за Ход»). Пул сам
//  (system.wounds.ablative/.ablativeMax) и поглощение урона — в
//  module/rules/wounds.mjs; здесь только регенерация, тем же приёмом, что
//  Призма (module/combat/prisma.mjs) — +1/Ход из hooks.mjs::updateCombat,
//  рядом с resetActionEconomy/processPrismaTurnStart.
//
//  Книга: аблативные Раны, если не указано обратного, НЕ могут быть
//  вылечены (wdbc-x1nz.2.86). Раньше +1/Ход получал любой актор с пулом —
//  Терминаторская броня, Мышечная Масса, Кровавый Щит и прочее. Сам
//  восстанавливается по тексту только «Абсурдно Толстый», и только своя доля
//  пула: остальные источники после урона не отрастают.
// ═══════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";

/** Возможность Дара «Абсурдно Толстый» — выдаётся его записью Конструктора. */
export const ABSURDLY_FAT_CAPABILITY = "gift.nurgle.absurdlyFat";
/** Его доля пула: «+10 аблативных Ран». */
export const ABSURDLY_FAT_ABLATIVE = 10;

/**
 * До скольких аблативных Ран пул отрастает сам: доля источников, у которых
 * реген прописан текстом. Сейчас такой источник один. 0 — не отрастает.
 */
export function ablativeRegenCap(actor) {
  const max = Number(actor?.system?.wounds?.ablativeMax) || 0;
  if (max <= 0 || !hasRuleFlag(actor, ABSURDLY_FAT_CAPABILITY)) return 0;
  return Math.min(max, ABSURDLY_FAT_ABLATIVE);
}

/**
 * +1 к текущим Аблативным Ранам актора в начале его Хода — только до доли
 * регенерирующих источников (ablativeRegenCap). Нет такой доли — не трогает
 * актора вовсе.
 */
export async function processAblativeWoundsTurnStart(actor) {
  const cap = ablativeRegenCap(actor);
  if (cap <= 0) return;
  const cur = Number(actor.system.wounds.ablative) || 0;
  if (cur < cap) await actor.update({ "system.wounds.ablative": Math.min(cap, cur + 1) });
}
