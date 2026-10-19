// module/rules/armour-training.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Armour Training / Тренировка в Броне (Арсенал, стр. 62, wdbc-3-65ff):
//  «Персонаж увеличивает Max.A этого вида брони на 10 и уменьшает её штраф к A
//  на 5 (если есть)». Специализация — ФИКСИРОВАННЫЙ список из книги
//  («Примитивная, флак, панцирная, силовая, экзотическая»), но, как и у
//  Melee/Weapon Training (rules/weapon-training.mjs), сегодня не проходит
//  через реестр способностей — одна покупка Таланта даёт любую из этих пяти
//  специализаций, читаем напрямую из system.specialization купленного Таланта.
//
//  Книжная таблица брони (стр. 235, Terminator Aegis — AP/W/S/A/Max.A/Wt/R)
//  действительно хранит ДВА разных числа: A (штраф, напр. −15) и Max.A
//  (потолок, напр. «–» = нет). Max.A уже был в схеме (armor.mjs::maxAgility,
//  читается armorAgilityCap). «Штраф к A» как отдельное число схема не
//  хранила вовсе — новое поле armor.mjs::agilityPenalty (wdbc-3-65ff).
//
//  Честно НЕ покрыто: «экзотическая» специализация не имеет соответствующего
//  system.armorType в данных (ни один предмет пака не использует armorType
//  "exotic" — только aspect/carapace/flak/mesh/power/simple), поэтому эта
//  специализация никогда ни с чем не совпадёт. armorType "mesh" и "aspect"
//  книжный список специализаций этого Таланта не упоминает вовсе — броня
//  этих типов бонуса не получает, это не пробел реализации, а то, что
//  написано (вернее, не написано) в книге.
// ════════════════════════════════════════════════════════════════════════════

const ARMOUR_TRAINING_NAME = /^Armour Training\b/i;

export const ARMOUR_TRAINING_AGILITY_BONUS = 10;
export const ARMOUR_TRAINING_PENALTY_REDUCTION = 5;

/** Русское слово специализации (как хранится в system.specialization) → armorType. */
const SPEC_TO_ARMOUR_TYPE = {
  "примитивная": "simple",
  "флак": "flak",
  "панцирная": "carapace",
  "силовая": "power"
  // "экзотическая" сознательно не отображена — см. шапку файла.
};

function norm(s) { return String(s || "").trim().toLowerCase(); }

/** Специализации купленных «Armour Training» (через запятую — непорезолвленный шаблон). */
function ownedArmourTypes(actor) {
  const specs = (actor?.items ?? [])
    .filter(i => i.type === "talent" && ARMOUR_TRAINING_NAME.test(i.name || ""))
    .flatMap(i => String(i.system?.specialization || "").split(",").map(s => s.trim()).filter(Boolean));
  return new Set(specs.map(s => SPEC_TO_ARMOUR_TYPE[norm(s)]).filter(Boolean));
}

/** Персонаж специализирован под Armour Training ЭТОГО вида брони. */
export function hasArmourTraining(actor, armorType) {
  if (!armorType) return false;
  return ownedArmourTypes(actor).has(armorType);
}

/** +10 к Max.A этого предмета, если есть специализация под его armorType. */
export function armourTrainingAgilityBonus(actor, armorType) {
  return hasArmourTraining(actor, armorType) ? ARMOUR_TRAINING_AGILITY_BONUS : 0;
}

/** −5 к штрафу A этого предмета (не ниже 0), если есть специализация под его armorType. */
export function armourTrainingPenaltyReduction(actor, armorType) {
  return hasArmourTraining(actor, armorType) ? ARMOUR_TRAINING_PENALTY_REDUCTION : 0;
}
