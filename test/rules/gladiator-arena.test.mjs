// Гладиатор: Бестиарий, Секуторий, Кровавое Представление, Ретиарий (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  naturalWeaponsOnly, bestiariusExtra, secutoriusArmed, secutoriusParryExtra, secutoriusPinOffered,
  unarmouredParts, bloodyPerformanceBonus, retiariusChainLength, gladiatorRules
} from "../../module/rules/gladiator-arena.mjs";
import { momentumPoints } from "../../module/rules/momentum.mjs";

const NS = "warhammer-dbc";
const w = (system, flags = {}) => ({ type: "weapon", name: "оружие", system: { equipped: true, ...system }, flags: { [NS]: flags } });
const glad = (items = [], momentum = 2) => ({
  items: [...items],
  system: { characteristics: { ag: { total: 47 } }, momentum: { value: momentum } },
  flags: { [NS]: { momentum } }
});
const talent = n => ({ type: "talent", name: n });

describe("Бестиарий", () => {
  const beast = { items: [w({ weaponClass: "melee" }, { integralAttack: true })] };
  const soldier = { items: [w({ weaponClass: "melee" })] };
  it("естественное оружие — только интегральные атаки", () => {
    expect(naturalWeaponsOnly(beast)).toBe(true);
    expect(naturalWeaponsOnly(soldier)).toBe(false);
  });
  it("второй бонус Момента против зверя, атака WS", () => {
    const g = glad([talent("Bestiarius")]);
    const per = momentumPoints(g) * 5;
    expect(bestiariusExtra(g, beast)).toBe(per);
    expect(bestiariusExtra(g, soldier)).toBe(0);
    if (per) expect(gladiatorRules(g, { targetActor: beast, char: "ws" })[0].effects[0].value).toBe(per);
    expect(gladiatorRules(g, { targetActor: beast, char: "bs" })).toEqual([]);
  });
});

describe("Секуторий", () => {
  const shield = w({ weaponClass: "melee", shieldAP: 2, range: 1 });
  const gladius = w({ weaponClass: "melee", range: 1 });
  const spear = w({ weaponClass: "melee", range: 4 });
  it("нужны щит и короткое рукопашное", () => {
    expect(secutoriusArmed(glad([talent("Secutorius"), shield, gladius]))).toBe(true);
    expect(secutoriusArmed(glad([talent("Secutorius"), shield, spear]))).toBe(false);
    expect(secutoriusArmed(glad([talent("Secutorius"), gladius]))).toBe(false);
  });
  it("рукопашная ×2, метательное щитом ×3", () => {
    const g = glad([talent("Secutorius"), shield, gladius]);
    const per = momentumPoints(g) * 5;
    expect(secutoriusParryExtra(g, { attackerWeaponClass: "melee", isMelee: true })).toBe(per);
    expect(secutoriusParryExtra(g, { attackerWeaponClass: "thrown", parryWeapon: shield, isMelee: false })).toBe(2 * per);
    expect(secutoriusParryExtra(g, { attackerWeaponClass: "thrown", parryWeapon: gladius, isMelee: false })).toBe(0);
  });
  it("прижать: 3 Успеха, оружие Rng 4+ или метательное", () => {
    const g = glad([talent("Secutorius"), shield, gladius]);
    expect(secutoriusPinOffered(g, { passed: true, deg: 3, attackerWeapon: spear })).toBe(true);
    expect(secutoriusPinOffered(g, { passed: true, deg: 2, attackerWeapon: spear })).toBe(false);
    expect(secutoriusPinOffered(g, { passed: true, deg: 3, attackerWeapon: gladius })).toBe(false);
  });
});

describe("Кровавое Представление и Ретиарий", () => {
  it("+10 за очко, +5 за открытую часть тела", () => {
    expect(bloodyPerformanceBonus(2, 3)).toBe(35);
    expect(bloodyPerformanceBonus(-1, 0)).toBe(0);
  });
  it("части тела без брони", () => {
    const armour = { type: "armor", system: { equipped: true, body: 4, head: 0, leftArm: 2 } };
    expect(unarmouredParts({ items: [armour] })).toBe(4);
    expect(unarmouredParts({ items: [] })).toBe(6);
  });
  it("цепь — A.b×2 м", () => {
    expect(retiariusChainLength(glad())).toBe(8);
  });
});
