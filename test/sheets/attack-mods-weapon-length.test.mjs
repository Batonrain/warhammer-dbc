// test/sheets/attack-mods-weapon-length.test.mjs
//
// Длина Оружия (wdbc-x1nz.2.67, стр. 39) в диалоге атаки: «Более длинное
// оружие» +5 теперь автогалочка (было — только ручная +5 без расчёта), и
// новая галочка штрафа за слишком длинное оружие вблизи (Rng ≥6).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";

function baseArgs(overrides = {}) {
  return {
    actor: { items: [], system: {} },
    attackCtx: {},
    attackerToken: null,
    gripRange: null,
    hasFatigue: false,
    hasLostEyes: false,
    isBlinded: false,
    isMelee: true,
    measured: null,
    targetHelpless: false,
    targetToken: null,
    weapon: null,
    wProps: [],
    wp: {},
    ...overrides
  };
}

function meleeWeapon(range, grips = "1р") {
  return { system: { weaponClass: "melee", range, grips } };
}

function actorWithMelee(range, grips = "1р") {
  return { items: [{ type: "weapon", system: { weaponClass: "melee", range, grips, equipped: true } }] };
}

describe("situationalMods: «Более длинное оружие» — автогалочка по реальному Rng", () => {
  it("оружие атакующего длиннее максимума цели — автоотмечена, с числом в note", () => {
    const { specificMods } = situationalMods(baseArgs({
      weapon: meleeWeapon(4), // "1р" +1 → эфф. 5
      attackCtx: { targetActor: actorWithMelee(2) } // "1р" +1 → эфф. 3
    }));
    const mod = specificMods.find(m => m.label === "Более длинное оружие");
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(5);
    expect(mod.autoCheck).toBe(true);
    expect(mod.note).toMatch(/Rng 5/);
  });

  it("оружие цели не короче — галочка есть, но не отмечена", () => {
    const { specificMods } = situationalMods(baseArgs({
      weapon: meleeWeapon(2),
      attackCtx: { targetActor: actorWithMelee(4) }
    }));
    const mod = specificMods.find(m => m.label === "Более длинное оружие");
    expect(mod.autoCheck).toBe(false);
    expect(mod.note).toBeUndefined();
  });

  it("нет цели — галочка присутствует, не отмечена, не падает", () => {
    const { specificMods } = situationalMods(baseArgs({ weapon: meleeWeapon(9) }));
    const mod = specificMods.find(m => m.label === "Более длинное оружие");
    expect(mod.autoCheck).toBe(false);
  });
});

describe("situationalMods: «Слишком длинное оружие вблизи» — штраф Rng≥6 в Базовом контакте", () => {
  it("Rng 6+ и Базовый контакт с целью — галочка появляется, автоотмечена, штраф верный", () => {
    const { specificMods } = situationalMods(baseArgs({
      weapon: meleeWeapon(5, "1р"), // 5+1=6 → −5
      measured: { contact: "base" }
    }));
    const mod = specificMods.find(m => m.label === "Слишком длинное оружие вблизи");
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(-5);
    expect(mod.autoCheck).toBe(true);
  });

  it("Rng ниже 6 — галочка не появляется вовсе", () => {
    const { specificMods } = situationalMods(baseArgs({
      weapon: meleeWeapon(3, "1р"), // 3+1=4
      measured: { contact: "base" }
    }));
    expect(specificMods.find(m => m.label === "Слишком длинное оружие вблизи")).toBeUndefined();
  });

  it("Rng 6+, но НЕ в контакте с целью — галочка не появляется", () => {
    const { specificMods } = situationalMods(baseArgs({
      weapon: meleeWeapon(5, "1р"),
      measured: { contact: "none" }
    }));
    expect(specificMods.find(m => m.label === "Слишком длинное оружие вблизи")).toBeUndefined();
  });
});
