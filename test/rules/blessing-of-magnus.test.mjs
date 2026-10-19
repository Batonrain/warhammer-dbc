// test/rules/blessing-of-magnus.test.mjs
//
// wdbc-1rno.5 (находка 10/12): hasActiveBlessingOfMagnus/
// actorHasEquippedForceWeapon/blessingOfMagnusFreeHalfAim — без Foundry.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import {
  hasActiveBlessingOfMagnus, actorHasEquippedForceWeapon, blessingOfMagnusFreeHalfAim
} from "../../module/rules/blessing-of-magnus.mjs";

const blessingItem = (isSustained = true) => ({
  type: "psychicPower", name: "Blessing of Magnus / Благословение Магнуса",
  system: { isSustained }, flags: {}
});
const forceWeapon = (equipped = true) => ({
  type: "weapon", name: "Психосиловой Клинок", system: { equipped, weaponProps: [{ key: "force" }] }
});
const plainWeapon = () => ({ type: "weapon", name: "Обычный меч", system: { equipped: true, weaponProps: [] } });

const actorWith = (tier, items = []) => ({ system: { wounds: { tier } }, items });

describe("hasActiveBlessingOfMagnus", () => {
  it("тяжело ранен, сила поддерживается — true", () => {
    expect(hasActiveBlessingOfMagnus(actorWith("heavy", [blessingItem()]))).toBe(true);
  });
  it("критически ранен (dying), сила поддерживается — true", () => {
    expect(hasActiveBlessingOfMagnus(actorWith("dying", [blessingItem()]))).toBe(true);
  });
  it("легко ранен (не heavy/dying) — false, даже если сила поддерживается", () => {
    expect(hasActiveBlessingOfMagnus(actorWith("light", [blessingItem()]))).toBe(false);
  });
  it("тяжело ранен, но сила НЕ поддерживается (isSustained:false) — false", () => {
    expect(hasActiveBlessingOfMagnus(actorWith("heavy", [blessingItem(false)]))).toBe(false);
  });
  it("тяжело ранен, но нет предмета — false", () => {
    expect(hasActiveBlessingOfMagnus(actorWith("heavy", []))).toBe(false);
  });
});

describe("actorHasEquippedForceWeapon", () => {
  it("экипированное психосиловое оружие — true", () => {
    expect(actorHasEquippedForceWeapon({ items: [forceWeapon()] })).toBe(true);
  });
  it("психосиловое, но не экипировано — false", () => {
    expect(actorHasEquippedForceWeapon({ items: [forceWeapon(false)] })).toBe(false);
  });
  it("обычное оружие — false", () => {
    expect(actorHasEquippedForceWeapon({ items: [plainWeapon()] })).toBe(false);
  });
});

describe("blessingOfMagnusFreeHalfAim", () => {
  it("всё сошлось — true", () => {
    const actor = actorWith("heavy", [blessingItem(), forceWeapon()]);
    expect(blessingOfMagnusFreeHalfAim(actor)).toBe(true);
  });
  it("сила активна, но оружие обычное — false", () => {
    const actor = actorWith("heavy", [blessingItem(), plainWeapon()]);
    expect(blessingOfMagnusFreeHalfAim(actor)).toBe(false);
  });
  it("оружие психосиловое, но сила не активна — false", () => {
    const actor = actorWith("light", [blessingItem(), forceWeapon()]);
    expect(blessingOfMagnusFreeHalfAim(actor)).toBe(false);
  });
});

// wdbc-1rno.34: «Псайкер получает бонус +5×PR на все тесты W» — только пока сила
// поддерживается и псайкер тяжело/критически ранен. Проверяется на НАСТОЯЩЕМ
// документе пака: фикстура, написанная руками, прошла бы и при пустой Механике.
describe("+5×PR на тесты W — настоящая запись пака", () => {
  const power = () => {
    const doc = packDocById("packs-src/psychic-powers/БОЖЕСТВЕННЫЕ_ДИСЦИПЛИНЫ/Тзинч", "o3xsSV7WGhTlYjas");
    return { ...doc, system: { ...doc.system, isSustained: true, sustainedEpr: 4 } };
  };
  const wpMods = (tier, item = power()) => {
    const actor = { system: { wounds: { tier }, psyker: { rating: 4 } } };
    const rules = rulesFromItemMechanics([item], () => true, actor);
    return rollModsFromRules(rules, { kind: "skill", char: "wp" }, { actor });
  };

  it("тяжело ранен: +5×PR (PR зафиксирован при манифестации) к тесту W", () => {
    expect(wpMods("heavy").map(m => m.value)).toEqual([20]);
  });
  it("критически ранен: тоже", () => {
    expect(wpMods("dying").map(m => m.value)).toEqual([20]);
  });
  it("здоров или легко ранен: бонуса нет", () => {
    expect(wpMods("healthy")).toEqual([]);
    expect(wpMods("light")).toEqual([]);
  });
  it("к тесту другой характеристики бонус не липнет", () => {
    const actor = { system: { wounds: { tier: "heavy" }, psyker: { rating: 4 } } };
    const rules = rulesFromItemMechanics([power()], () => true, actor);
    expect(rollModsFromRules(rules, { kind: "skill", char: "ag" }, { actor })).toEqual([]);
  });
  it("сила не поддерживается — источник неактивен, бонуса нет", () => {
    const actor = { system: { wounds: { tier: "heavy" }, psyker: { rating: 4 } } };
    const rules = rulesFromItemMechanics([power()], () => false, actor);
    expect(rollModsFromRules(rules, { kind: "skill", char: "wp" }, { actor })).toEqual([]);
  });
});
