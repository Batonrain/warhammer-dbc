// test/combat/armor-mods-ablative.test.mjs
//
// wdbc-bxw6: мод брони «Аблативная» (armor-mods/Укрепление) отдаёт свой
// ЖИВОЙ остаток заряда (system.ablativeCharge) вместо статичного effects.apAll,
// пока system.ablative:true — module/combat/armor-mods.mjs::getArmorModEffects.
// activeAblativeArmorMods собирает такие моды по всем надетым доспехам актора
// для последующего списания в combat/damage.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getArmorModEffects, activeAblativeArmorMods } from "../../module/combat/armor-mods.mjs";

function armorItem(id, overrides = {}) {
  return { id, type: "armor", system: { equipped: true, armorType: "flak", ...overrides } };
}

function modItem(id, installedOn, overrides = {}) {
  return {
    id, type: "armorMod",
    system: {
      installedOn, category: "armor", activatable: false, active: false,
      ablative: false, ablativeCharge: 0, effects: {}, ...overrides
    },
    getFlag: () => undefined
  };
}

function actorWith(items) {
  return { system: { helmetOff: false }, items };
}

describe("getArmorModEffects: аблативный мод отдаёт ablativeCharge, не apAll", () => {
  it("ablative:false — как раньше, читает effects.apAll", () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { effects: { apAll: 5 } });
    const actor = actorWith([armor, mod]);
    expect(getArmorModEffects(actor, armor).apAll).toBe(5);
  });

  it("ablative:true, заряд полный — apAll = ablativeCharge", () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 5, effects: { apAll: 5 } });
    const actor = actorWith([armor, mod]);
    expect(getArmorModEffects(actor, armor).apAll).toBe(5);
  });

  it("ablative:true, заряд истощён (0) — apAll = 0, effects.apAll игнорируется", () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 0, effects: { apAll: 5 } });
    const actor = actorWith([armor, mod]);
    expect(getArmorModEffects(actor, armor).apAll).toBe(0);
  });
});

describe("activeAblativeArmorMods: собирает работающие аблативные моды по всем надетым доспехам", () => {
  it("пусто, если аблативных модов нет", () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { effects: { apAll: 3 } });
    expect(activeAblativeArmorMods(actorWith([armor, mod]))).toEqual([]);
  });

  it("находит аблативный мод с ненулевым зарядом", () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 5 });
    expect(activeAblativeArmorMods(actorWith([armor, mod]))).toEqual([mod]);
  });

  it("истощённый (0) аблативный мод не попадает в список", () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 0 });
    expect(activeAblativeArmorMods(actorWith([armor, mod]))).toEqual([]);
  });

  it("снятая (не equipped) броня не даёт свои моды в список", () => {
    const armor = armorItem("a1", { equipped: false });
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 5 });
    expect(activeAblativeArmorMods(actorWith([armor, mod]))).toEqual([]);
  });

  it("собирает по НЕСКОЛЬКИМ доспехам разом (apAll действует на все зоны сразу)", () => {
    const armorA = armorItem("a1");
    const armorB = armorItem("a2");
    const modA = modItem("m1", "a1", { ablative: true, ablativeCharge: 5 });
    const modB = modItem("m2", "a2", { ablative: true, ablativeCharge: 3 });
    const actor = actorWith([armorA, armorB, modA, modB]);
    expect(activeAblativeArmorMods(actor)).toEqual([modA, modB]);
  });
});
