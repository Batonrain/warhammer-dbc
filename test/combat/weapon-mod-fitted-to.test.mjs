// test/combat/weapon-mod-fitted-to.test.mjs
//
// Подстройка модификации под конкретного персонажа (wdbc-1rno, Custom Grip):
// +fittedBonus на Атаку для актора с id===fittedToId, −fittedBonus всем
// остальным. Пустой fittedToId — ещё не подстроена, эффекта нет ни для кого
// (module/combat/weapon-mods.mjs::getModEffects, module/data/item/weapon-mod.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects } from "../../module/combat/weapon-mods.mjs";

function weapon() {
  return { id: "w1", type: "weapon", system: { equipped: true, weaponProps: [] } };
}

function customGripMod({ installedOn = "w1", fittedToId = "", fittedBonus = 5 } = {}) {
  return {
    id: "m1", name: "Custom Grip / Персональный Хват", type: "weaponMod",
    system: { installedOn, effects: { fittedToId, fittedBonus } }
  };
}

function actorWith(id, items) {
  const list = [...items];
  list.get = i => list.find(x => x.id === i) ?? null;
  return { id, items: list };
}

describe("getModEffects: подстройка под персонажа (wdbc-1rno, Custom Grip)", () => {
  it("владелец, под которого подстроена — +бонус", () => {
    const w = weapon();
    const actor = actorWith("hero-1", [customGripMod({ fittedToId: "hero-1", fittedBonus: 5 })]);
    expect(getModEffects(actor, w).attackMod).toBe(5);
  });

  it("другой персонаж с тем же оружием — −бонус", () => {
    const w = weapon();
    const actor = actorWith("thief-2", [customGripMod({ fittedToId: "hero-1", fittedBonus: 5 })]);
    expect(getModEffects(actor, w).attackMod).toBe(-5);
  });

  it("ещё не подстроена (fittedToId пуст) — эффекта нет", () => {
    const w = weapon();
    const actor = actorWith("hero-1", [customGripMod({ fittedToId: "" })]);
    expect(getModEffects(actor, w).attackMod).toBe(0);
  });

  it("складывается с обычным attackMod модификации", () => {
    const w = weapon();
    const mod = customGripMod({ fittedToId: "hero-1", fittedBonus: 5 });
    mod.system.effects.attackMod = 10; // гипотетическая доп. модификация на том же предмете
    const actor = actorWith("hero-1", [mod]);
    expect(getModEffects(actor, w).attackMod).toBe(15);
  });

  it("несколько модификаций: только Custom Grip несёт fittedToId", () => {
    const w = weapon();
    const plain = { id: "m2", name: "Reinforced", type: "weaponMod", system: { installedOn: "w1", effects: { attackMod: 0 } } };
    const grip = customGripMod({ fittedToId: "hero-1", fittedBonus: 5 });
    const actor = actorWith("hero-1", [plain, grip]);
    expect(getModEffects(actor, w).attackMod).toBe(5);
  });
});
