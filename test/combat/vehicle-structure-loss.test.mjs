// test/combat/vehicle-structure-loss.test.mjs
//
// applyStructureLoss (wdbc-tejb, Bane «Технике») — непоглощаемый урон в
// Структуру напрямую, мимо брони и без теста. Та же overflow→Критические
// арифметика, что у Ран (rules/wounds.mjs::woundLossAfter), но пишет в
// system.structure, не system.wounds.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { applyStructureLoss } from "../../module/combat/vehicle.mjs";

function vehicle(structure) {
  const updates = [];
  return {
    type: "vehicle", name: "Rhino",
    system: { structure },
    update: async data => { updates.push(data); Object.assign(structure,
      { value: data["system.structure.value"], critical: data["system.structure.critical"] }); },
    _updates: updates
  };
}

describe("applyStructureLoss", () => {
  it("урон в пределах запаса Структуры — просто вычитается", async () => {
    const v = vehicle({ value: 20, critical: 0 });
    const res = await applyStructureLoss(v, 5);
    expect(res.newValue).toBe(15);
    expect(res.newCritical).toBe(0);
    expect(res.gotCritical).toBe(false);
    expect(v.system.structure.value).toBe(15);
  });

  it("урон сверх запаса — остаток уходит в Критические", async () => {
    const v = vehicle({ value: 3, critical: 0 });
    const res = await applyStructureLoss(v, 5);
    expect(res.newValue).toBe(0);
    expect(res.newCritical).toBe(2);
    expect(res.gotCritical).toBe(true);
  });

  it("amount <= 0 — actor.update не вызывается вовсе", async () => {
    const v = vehicle({ value: 10, critical: 0 });
    await applyStructureLoss(v, 0);
    expect(v._updates.length).toBe(0);
  });
});
