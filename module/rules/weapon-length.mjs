// module/rules/weapon-length.mjs
// ════════════════════════════════════════════════════════════════════════
//  ДЛИНА ОРУЖИЯ (wdbc-x1nz.2.67, стр. 39) — числовые сравнения поверх
//  meleeEffectiveRange (module/constants/combat.mjs): кто длиннее, бонус
//  атакующему/защищающемуся, штраф на слишком длинное оружие вблизи.
//
//  Чистая логика — actor.items здесь читается как обычные данные (та же
//  степень «Foundry-зависимости», что у free-attack.mjs::hasLockingWeapon),
//  без canvas/токенов.
//
//  Сознательно НЕ входит сюда (см. тикет): расширенный Базовый контакт для
//  оружия Rng 8/9 (нужна геометрия карты, отдельная задача) и выбор
//  переменной длины оружия за атаку (нужна новая модель диапазона в данных
//  предмета вместо одного числа range — контентная работа по всем profiles).
// ════════════════════════════════════════════════════════════════════════

import { parseGrips, meleeEffectiveRange } from "../constants/combat.mjs";

/**
 * Макс. действующая длина среди экипированного рукопашного оружия актора —
 * основной (первый) Хват, без бонуса Приёма (актор им не атакует прямо
 * сейчас, это чужая мерка «что у него в руках»).
 * @param {object|null} actor
 */
export function actorMaxMeleeRange(actor) {
  const weapons = (actor?.items ?? []).filter(i =>
    i.type === "weapon" && i.system?.equipped && i.system?.weaponClass === "melee");
  let max = 0;
  for (const w of weapons) {
    const primary = parseGrips(w.system?.grips)[0] ?? null;
    const rng = meleeEffectiveRange(w.system?.range, primary, "standard");
    if (rng > max) max = rng;
  }
  return max;
}

/**
 * Правило 1 (стр. 39): выбранная для атаки длина больше максимальной длины
 * самого длинного оружия в руках цели → атакующему +5.
 * @param {number} attackerRange действующий Rng атакующего оружия (meleeEffectiveRange)
 * @param {object|null} targetActor
 */
export function longerWeaponBonus(attackerRange, targetActor) {
  if (!targetActor) return false;
  return (Number(attackerRange) || 0) > actorMaxMeleeRange(targetActor);
}

/**
 * Правило 2 (стр. 39): при Натиске на противника, вооружённого оружием на
 * 3 и более длиннее, тот получает +5 на тесты Избегания от этой атаки.
 * @param {number} attackerRange
 * @param {number} defenderRange
 */
export function chargeTargetDodgeBonus(attackerRange, defenderRange) {
  return ((Number(defenderRange) || 0) - (Number(attackerRange) || 0)) >= 3;
}

/**
 * Правило 4 (стр. 39): оружие с минимальным Rng 6+ получает штраф −5 за
 * каждый пункт Rng выше 5 при атаке по цели в Базовом контакте — слишком
 * длинное оружие мешает вблизи. Узкие пространства/давка могут снижать этот
 * минимальный эффективный Rng по решению ГМа (не автоматизировано — то же
 * решение, что уже принято для аналогичных ГМ-клапанов в этом файле).
 * @param {number} rng действующий Rng атаки
 */
export function closeQuartersPenalty(rng) {
  const r = Number(rng) || 0;
  return r >= 6 ? -5 * (r - 5) : 0;
}
