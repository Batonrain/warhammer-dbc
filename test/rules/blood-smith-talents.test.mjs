// Кузнец Крови: Кольцо Крови, Связанный Кровью, Расковать (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  daemonKey, enslavedList, addEnslaved, removeEnslaved, boundByBloodSacrifice, unforgeable, unforgeFormula, ringOfBloodWeaponUpdate
} from "../../module/rules/blood-smith-talents.mjs";
import { addFlatDamage } from "../../module/constants/demon-weapon.mjs";

const NS = "warhammer-dbc";

describe("порабощённые демоны", () => {
  it("список без повторов по имени, удаление", () => {
    let l = addEnslaved([], { name: "Bloodletter / Кровопускатель", wb: 4 });
    l = addEnslaved(l, { name: "bloodletter", wb: 5 });
    expect(l).toHaveLength(1);
    expect(l[0].wb).toBe(5);
    expect(removeEnslaved(l, "Bloodletter")).toEqual([]);
    expect(daemonKey("Herald  of Khorne / Глашатай")).toBe("herald of khorne");
  });
  it("Связанный Кровью: только Призыв порабощённого, только с Талантом", () => {
    const a = { items: [{ type: "talent", name: "Bound by Blood / Связанный Кровью" }],
      flags: { [NS]: { enslavedDaemons: [{ name: "Bloodletter", wb: 4 }] } } };
    expect(enslavedList(a)).toHaveLength(1);
    expect(boundByBloodSacrifice(a, "summon", "Bloodletter / Кровопускатель")).toBe(true);
    expect(boundByBloodSacrifice(a, "binding", "Bloodletter")).toBe(false);
    expect(boundByBloodSacrifice(a, "summon", "Plaguebearer")).toBe(false);
    expect(boundByBloodSacrifice({ ...a, items: [] }, "summon", "Bloodletter")).toBe(false);
  });
});

describe("демоническое оружие", () => {
  it("первый демон: +W.b к Dmg и Pen, Reinforced, без Primitive", () => {
    const { second, update } = ringOfBloodWeaponUpdate(
      { damage: "1d10+2", penetration: 3, weaponProps: [{ key: "primitive" }] }, { name: "Bloodletter", wb: 4 }, addFlatDamage);
    expect(second).toBe(false);
    expect(update["system.penetration"]).toBe(7);
    expect(update["system.damage"]).toBe(addFlatDamage("1d10+2", 4));
    expect(update["system.weaponProps"]).toEqual([{ key: "reinforced" }]);
    expect(update["system.daemonWeapon"]).toMatchObject({ bound: true, subdued: true, demonWb: 4 });
  });
  it("второй демон: W.b суммируется", () => {
    const { second, update } = ringOfBloodWeaponUpdate(
      { damage: "1d10+6", penetration: 7, daemonWeapon: { bound: true, demonWb: 4, demonName: "A" } }, { name: "B", wb: 3 }, addFlatDamage);
    expect(second).toBe(true);
    expect(update["system.daemonWeapon.demonWb"]).toBe(7);
    expect(update["system.penetration"]).toBe(10);
  });
  it("Расковать: только с порабощённым демоном, 2d10+2×W.b", () => {
    expect(unforgeable({ type: "weapon", system: { daemonWeapon: { bound: true, subdued: true } } })).toBe(true);
    expect(unforgeable({ type: "weapon", system: { daemonWeapon: { bound: true, subdued: false } } })).toBe(false);
    expect(unforgeFormula(5)).toBe("2d10 + 10");
  });
});
