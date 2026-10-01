// module/rules/char-damage-bonus.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Надбавки к урону в Характеристики — одно место для всех источников
//  (wdbc-3epax). Генетическое Угасание Репликанта (+1 за мутацию) и
//  Нестабильный Геном Сплайса (+1 и +1 за адаптацию сверх трёх) растут от
//  КАЖДОГО урона в Характеристику; источник, записавший урон мимо
//  combat/char-damage.mjs::applyCharDamage (Руна Сигиллита), берёт надбавки
//  отсюда.
// ════════════════════════════════════════════════════════════════════════════

import { GENETIC_DECAY, geneticDecayBonus, mutationCountNoGifts, traitWithKey } from "./replicant.mjs";
import { unstableGenomeBonus } from "./splice-adaptations.mjs";

/**
 * Урон в одну Характеристику с надбавками.
 * Порядок: Угасание считается от исходного урона, Геном
 * прибавляется к уже выросшему; ноль остаётся нулём.
 * @returns {{amount:number, decay:number, genome:number}} amount — итог
 */
export function charDamageWithBonuses(actor, amount) {
  const base = Number(amount) || 0;
  const decay = geneticDecayBonus(base, mutationCountNoGifts(actor), !!traitWithKey(actor, GENETIC_DECAY));
  const grown = base + decay;
  const genome = grown > 0 ? unstableGenomeBonus(actor) : 0;
  return { amount: grown + genome, decay, genome };
}
