// module/rules/gladiator-talents.mjs
// Таланты Гладиатора поверх Момента (Черта Momentum, combat/momentum.mjs).
//
// Dimacherus / Димахер: «Если вооружён хотя бы двумя рукопашными оружиями,
// каждое попадание ими наносит дополнительный урон, равный его текущим очкам
// Момента». Читает combat/attack.mjs (flatBonus рукопашной).

import { hasItemNamed } from "./req-atom.mjs";
import { heldWeapons } from "./dual-wield-talents.mjs";

/** Двое и больше рукопашных в руках (интегральные атаки — не оружие в руке). */
export function twoMeleeHeld(actor) {
  return heldWeapons(actor).filter(w => String(w.system?.weaponClass ?? "").toLowerCase() === "melee").length >= 2;
}

/** Прибавка Димахера к урону этой атаки. */
export function dimacherusBonus(actor, { isMelee = false, momentum = 0 } = {}) {
  if (!isMelee || !(momentum > 0) || !hasItemNamed(actor, "Dimacherus", ["talent"])) return 0;
  return twoMeleeHeld(actor) ? momentum : 0;
}
