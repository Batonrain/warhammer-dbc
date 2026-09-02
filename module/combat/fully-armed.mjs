// module/combat/fully-armed.mjs
//
// Fully Armed / Во Всеоружии (Трейт, wdbc-1rno): не-тяжёлое стрелковое оружие
// с установленным модом Custom Grip (в паке — «Personal Grip»/«Персональный
// Хват», packs-src/weapon-mods/Стрелковое/Прочие и .../Рукопашное/Разное)
// считается удобным — актор с этой Чертой получает +1 Надёжность и вдвое
// меньший вес (окр.▼) такого оружия для расчёта Разгрузки. Мод определяется
// по русской половине имени (itemHasName splits "/", см. ловушку двуязычных
// имён — doombc-hand-of-death), не по английской: «Custom Grip» дословно в
// паке не встречается, только его перевод.
//
// −1 ОД к перезарядке (до ½) книжного текста НЕ смоделирован: system.reload
// (module/data/item/weapon.mjs) — свободная строка («1», «полн.», «2 полн.»),
// в системе нигде нет числового движка экономии действий, который бы её
// читал programmatically — тот же честный пробел у общего Таланта с идентичной
// формулировкой ("вдвое, окр.▼", talents-library.mjs:84/capabilities.mjs:1420).

import { itemHasName } from "../rules/predicates.mjs";

const CUSTOM_GRIP_NAME = "Персональный Хват";
const FULLY_ARMED_NAME = "Fully Armed";

export function hasFullyArmed(actor) {
  return !!actor?.items?.some?.(i => i.type === "trait" && itemHasName(i, FULLY_ARMED_NAME));
}

// «Не-тяжёлое стрелковое» — weaponClass "pistol"/"basic" (см. templates/item/
// parts/weapon.hbs: pistol/basic/heavy/melee — heavy и melee исключены).
function isEligibleWeaponClass(weapon) {
  const wc = weapon?.system?.weaponClass;
  return wc === "pistol" || wc === "basic";
}

export function hasCustomGrip(actor, weapon) {
  if (!actor?.items || !weapon?.id) return false;
  return actor.items.some(i =>
    i.type === "weaponMod" && i.system?.installedOn === weapon.id && itemHasName(i, CUSTOM_GRIP_NAME));
}

/** +1 Надёжность за Fully Armed (module/combat/weapon-mods.mjs::getModEffects). */
export function fullyArmedReliabilityBonus(actor, weapon) {
  if (weapon?.type !== "weapon" || !isEligibleWeaponClass(weapon)) return 0;
  if (!hasFullyArmed(actor) || !hasCustomGrip(actor, weapon)) return 0;
  return 1;
}

/**
 * Эффективный вес оружия для расчёта Разгрузки (module/constants/rig.mjs).
 * Округление вниз до 0.1 кг — вес в паках хранится с шагом 0.1 (weapon.hbs),
 * floor до целого кг обнулял бы лёгкое оружие (0.8 → 0).
 */
export function fullyArmedWeight(actor, weapon, baseWeight) {
  if (weapon?.type !== "weapon" || !isEligibleWeaponClass(weapon)) return baseWeight;
  if (!hasFullyArmed(actor) || !hasCustomGrip(actor, weapon)) return baseWeight;
  return Math.floor((baseWeight / 2) * 10) / 10;
}
