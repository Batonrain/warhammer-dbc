// module/rules/duelist-evasion.mjs
// Избегания пачки «дуэлянты» одной точкой для combat/defense.mjs: что
// прибавить к Порогу Уклонения/Парирования от этого атакующего и какие строки
// показать на карточке защиты. Чистая часть без Foundry.
//
//   Бестиарий (Гладиатор) — второй бонус Момента против «зверя»;
//   Секуторий (Гладиатор) — Момент ×2/×3 на Парирование, «прижать оружие»;
//   Провидец Войны (Виткис) — −3×Успехи Избеганиям цели от атак Виткиса;
//   Пропустить, Стойка Вора (Ворон) — строки при Избегании на 5+.

import { bestiariusExtra, secutoriusParryExtra, secutoriusPinOffered } from "./gladiator-arena.mjs";
import { warSeerEvasionMod } from "./vitkis-talents.mjs";
import { ravenEvasionNotes } from "./raven-talents.mjs";

/**
 * @param {object} defender
 * @param {?object} attacker
 * @param {{kind:"dodge"|"parry", isMelee:boolean, attackerWeapon:?object, parryWeapon:?object, combatId:string}} o
 * @returns {{mod:number, parts:string[]}}
 */
export function duelistEvasionMod(defender, attacker, { kind = "dodge", isMelee = false, attackerWeapon = null, parryWeapon = null, combatId = "" } = {}) {
  const parts = [];
  let mod = 0;
  const add = (v, label) => { if (v) { mod += v; parts.push(`${label} ${v >= 0 ? "+" : ""}${v}`); } };
  if (attacker) add(bestiariusExtra(defender, attacker), "Бестиарий");
  if (kind === "parry") add(secutoriusParryExtra(defender, {
    attackerWeaponClass: attackerWeapon?.system?.weaponClass ?? "", parryWeapon, isMelee }), "Секуторий");
  if (attacker) add(warSeerEvasionMod(defender, attacker, combatId), `Провидец Войны (${attacker.name})`);
  return { mod, parts };
}

/** Строки карточки защиты после броска. */
export function duelistEvasionNotes(defender, { kind = "dodge", passed = false, deg = 0, isMelee = false, attackerWeapon = null } = {}) {
  const out = [...ravenEvasionNotes(defender, { passed, deg, isMelee })];
  if (kind === "parry" && secutoriusPinOffered(defender, { passed, deg, attackerWeapon }))
    out.push("🛡️ Секуторий: можно потратить 3 Успеха и прижать оружие щитом — щит занят, противник не может пользоваться этим оружием, пока Гладиатор не отпустит.");
  return out;
}
