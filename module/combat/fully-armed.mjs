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
// −1 ОД к перезарядке (до ½) книжного текста по-прежнему НЕ смоделирован
// здесь: с wdbc-x1nz.2.54 у system.reload (module/data/item/weapon.mjs)
// наконец есть числовой движок — combat/reload.mjs::reloadApCost (½ → 1 ОД,
// целое N → 2N ОД) — но САМА скидка Fully Armed поверх него ещё не подключена.
// Тот же остаток у общего Таланта с идентичной формулировкой ("вдвое, окр.▼",
// talents-library.mjs:84/capabilities.mjs:1420).

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";

const CUSTOM_GRIP_NAME = "Персональный Хват";
const FULLY_ARMED_NAME = "Fully Armed";

export function hasFullyArmed(actor) {
  return hasAbility(actor, "ability.fullyArmed", FULLY_ARMED_NAME, "trait");
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
