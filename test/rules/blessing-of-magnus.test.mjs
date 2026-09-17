// test/rules/blessing-of-magnus.test.mjs
//
// wdbc-1rno.5 (находка 10/12): hasActiveBlessingOfMagnus/
// actorHasEquippedForceWeapon/blessingOfMagnusFreeHalfAim — без Foundry.

import { describe, it, expect } from "vitest";
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
