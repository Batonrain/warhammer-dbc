// test/rules/character-weapon-property-derived.test.mjs
//
// Производная сторона свойств оружия (wdbc-plsf): накопленная Коррозия
// уменьшает absorption.armorOnly И wornOnly (иначе разъеденный шлем «съедал»
// бы естественную броню в правиле Глаза), снаряд Проникающего в торсе/ноге
// даёт плоский −1 SPD. Пишущая сторона — test/combat/weapon-property-effects.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const armour = () => ({
  id: "a1", type: "armor", effects: [], flags: {},
  system: { equipped: true, head: 5, body: 4, leftArm: 3, rightArm: 3, leftLeg: 3, rightLeg: 3, stacks: false },
  getFlag: () => undefined
});

function derived(patch = {}, items = [armour()]) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && system[k] && typeof system[k] === "object") Object.assign(system[k], v);
    else system[k] = v;
  }
  system.characteristics.ag.base = 40;   // иначе SPD упирается в пол 0.5 и −1 не виден
  const list = [...items]; list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({ type: "character", name: "x", system, items: list, getFlag: () => undefined });
  return system;
}

describe("Коррозия → поглощение", () => {
  it("armorCorrosion уменьшает armorOnly и wornOnly в своей локации, соседние не трогает", () => {
    const s = derived({ armorCorrosion: { head: 2 } });
    expect(s.absorption.armorOnly.head).toBe(3);
    expect(s.absorption.wornOnly.head).toBe(3);
    expect(s.absorption.armorOnly.body).toBe(4);
  });

  it("коррозия больше AP — в ноль, не в минус", () => {
    const s = derived({ armorCorrosion: { body: 99 } });
    expect(s.absorption.armorOnly.body).toBe(0);
    expect(s.absorption.wornOnly.body).toBe(0);
  });
});

describe("Проникающее → SPD", () => {
  it("снаряд в торсе — −1 SPD; в руке — нет; торс+нога не складываются", () => {
    const base = derived().movement.halfMove;
    expect(derived({ piercingWounds: { body: 1 } }).movement.halfMove).toBe(base - 1);
    expect(derived({ piercingWounds: { rightArm: 1 } }).movement.halfMove).toBe(base);
    expect(derived({ piercingWounds: { body: 1, leftLeg: 1 } }).movement.halfMove).toBe(base - 1);
  });
});
