// module/rules/weapon-length.mjs
// ════════════════════════════════════════════════════════════════════════
//  ДЛИНА ОРУЖИЯ (wdbc-x1nz.2.67, стр. 39) — числовые сравнения поверх
//  meleeEffectiveRange (module/constants/combat.mjs): кто длиннее, бонус
//  атакующему/защищающемуся, штраф на слишком длинное оружие вблизи,
//  расширенный Базовый контакт для Rng 8/9 (wdbc-x1nz.2.67.1).
//
//  Чистая логика — actor.items здесь читается как обычные данные (та же
//  степень «Foundry-зависимости», что у free-attack.mjs::hasLockingWeapon),
//  без canvas/токенов; geometry-зависимые функции (meleeContactDisplay)
//  принимают уже измеренные числа (contact/edgeM из tactical-map.mjs), а не
//  сами токены.
//
//  Сознательно НЕ входит сюда (см. тикет wdbc-x1nz.2.67.2): выбор переменной
//  длины оружия за атаку — нужна новая модель диапазона в данных предмета
//  вместо одного числа range, контентная работа по всем profiles.
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

/**
 * Правило 3 (стр. 39, wdbc-x1nz.2.67.1): «Оружие с Rng 8 может атаковать в
 * рукопашной и создаёт Базовый контакт через клетку 1×1, а не только в упор,
 * оружие с Rng 9 — через две.» Зазор (в клетках/метрах — 1 клетка сцены этой
 * системы уже везде считается 1м, см. tactical-map.mjs), при котором такое
 * оружие всё ещё бьёт как в Базовом контакте.
 * @param {number} effectiveRng действующий Rng атаки (meleeEffectiveRange)
 * @returns {number} 0 — обычное оружие, 1 — Rng 8, 2 — Rng 9+
 */
export function extendedReachCells(effectiveRng) {
  const r = Number(effectiveRng) || 0;
  if (r >= 9) return 2;
  if (r >= 8) return 1;
  return 0;
}

/**
 * Вид контакта для целей рукопашной атаки — результат contactType()
 * (tactical-map.mjs) с поправкой на правило 3: если Базы не касаются, но
 * зазор укладывается в extendedReachCells длинного оружия, контакт всё
 * равно легален ("reach"). Сам contactType() не трогаем — сознательное
 * решение по масштабу (см. тикет): протаскивать Rng оружия в общий примитив,
 * которым пользуются Свободная Атака/«Связан в Рукопашной»/Прикрывающая
 * Стойка/гейт Избирательной атаки, ради редкого Rng 8-9 не стоит.
 * @param {"none"|"base"|"deep"} contact исход contactType(rectA, rectB)
 * @param {number} edgeM измеренный зазор в метрах (tactical-map.mjs::measureTokens)
 * @param {number} effectiveRng действующий Rng атакующего оружия
 * @returns {"none"|"base"|"deep"|"reach"}
 */
export function meleeContactDisplay(contact, edgeM, effectiveRng) {
  if (contact !== "none") return contact;
  const reach = extendedReachCells(effectiveRng);
  return (reach > 0 && (Number(edgeM) || 0) <= reach) ? "reach" : "none";
}
