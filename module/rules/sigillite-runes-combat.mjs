// module/rules/sigillite-runes-combat.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Руны Сигиллитов — начисление по тактам боя (wdbc-fsl9).
//
//  Книга (DoomBC — Психокеры-Жабы, стр. 101-102):
//    • «В начале боя персонаж стартует с бPR рун» — УСТАНОВКА значения, а не
//      прибавка: «стартует с», а не «получает»;
//    • «В начале своего хода псайкер получает бPR рун и еще по +1 за каждую
//      ступень в навыке Forbidden Lore (Archeotech)» — прибавка каждый Ход;
//    • Rune Calculator: «При наступлении первого хода псайкера в бою он
//      получает дополнительно +I.b рун» — один раз за бой.
//
//  Отдельным файлом от rules/sigillite-runes.mjs намеренно: тот импортируется
//  пересчётом листа (rules/character.mjs) на КАЖДЫЙ prepareDerivedData, и
//  тащить в этот горячий путь ещё и троттлинг с календарём незачем.
//
//  «Один раз за бой» считает не свой счётчик, а общий примитив
//  rules/cooldown.mjs (unit "battle" — метка сравнивается с game.combat.id).
//  Своя мапа id→Set пережила бы перезагрузку мира хуже: игрок получил бы
//  бонус Вычислителя второй раз за тот же бой.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuneMagic, runeGainPerTurn, runeStartOfCombat, runeCalculatorBonus,
         runeUpdate } from "./sigillite-runes.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "./cooldown.mjs";

/** Метка «бонус Вычислителя Рун за этот бой уже выдан». */
export const RUNE_CALCULATOR_FLAG = "rune.sigillites.calculator";

/**
 * Начало боя: пул выставляется в бPR (не прибавляется).
 * Молча ничего не делает всем, у кого нет Черты «Магия Сигиллитов».
 */
export async function processSigilliteRunesCombatStart(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor || !hasRuneMagic(actor)) continue;
    const patch = runeUpdate(actor, 0, { set: runeStartOfCombat(actor) });
    if (patch) await actor.update(patch);
  }
}

/**
 * Начало своего Хода: +бPR и +1 за ступень Археотеха, плюс разовый за бой
 * бонус Таланта «Вычислитель Рун».
 *
 * Возвращает начисленное число (0 — ничего не начислено): так тест видит
 * решение, не разбирая патч.
 */
export async function processSigilliteRunesTurnStart(actor) {
  if (!actor || !hasRuneMagic(actor)) return 0;
  let gain = runeGainPerTurn(actor);
  // «Первый ход псайкера в бою» — именно первый ХОД, а не старт боя: в
  // системе бой начинается кнопкой «Begin Combat», и до своего Хода псайкер
  // может не дожить. Поэтому метка ставится здесь, а не в combatStart.
  if (isCapabilityAvailable(actor, RUNE_CALCULATOR_FLAG, "battle")) {
    const bonus = runeCalculatorBonus(actor);
    if (bonus > 0) gain += bonus;
    await markCapabilityUsed(actor, RUNE_CALCULATOR_FLAG, "battle");
  }
  if (gain <= 0) return 0;
  const patch = runeUpdate(actor, gain);
  if (patch) await actor.update(patch);
  return gain;
}
