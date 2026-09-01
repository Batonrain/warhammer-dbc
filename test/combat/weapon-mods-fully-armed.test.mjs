// test/combat/weapon-mods-fully-armed.test.mjs
//
// Fully Armed / Во Всеоружии (wdbc-1rno): +1 Надёжность через getModEffects
// (module/combat/weapon-mods.mjs) — вес отдельно, см. test/apps/rig-manager-data.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects } from "../../module/combat/weapon-mods.mjs";

function weapon(weaponClass = "pistol") {
  return { id: "w1", type: "weapon", system: { equipped: true, weaponProps: [], weaponClass } };
}

function customGripMod() {
  return { id: "m1", name: "Personal Grip / Персональный Хват", type: "weaponMod", system: { installedOn: "w1", effects: {} } };
}

function actorWith(items) {
  const list = [...items];
  list.get = i => list.find(x => x.id === i) ?? null;
  return { items: list };
}

describe("getModEffects: Fully Armed (wdbc-1rno)", () => {
  it("Черта + Custom Grip + не-тяжёлое стрелковое — +1 Надёжность", () => {
    const actor = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod()]);
    expect(getModEffects(actor, weapon("pistol")).reliabilityMod).toBe(1);
  });

  it("нет Черты — Надёжность не меняется", () => {
    const actor = actorWith([customGripMod()]);
    expect(getModEffects(actor, weapon("pistol")).reliabilityMod).toBe(0);
  });

  it("складывается с обычным reliabilityMod модификации", () => {
    const mod = customGripMod();
    mod.system.effects.reliabilityMod = 2; // гипотетическая доп. модификация
    const actor = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, mod]);
    expect(getModEffects(actor, weapon("pistol")).reliabilityMod).toBe(3);
  });

  it("тяжёлое оружие — не действует", () => {
    const actor = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod()]);
    expect(getModEffects(actor, weapon("heavy")).reliabilityMod).toBe(0);
  });
});
