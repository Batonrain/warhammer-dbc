// test/rules/vehicle-daemonic-absorb.test.mjs
//
// wdbc-8nz6 (доводка): «Демонический (X)» — +X к поглощению машины,
// агрегируется в traitFlags.daemonicAbsorb (рейтинг Черты, максимум если
// несколько предметов).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { prepareVehicleDerived } from "../../module/rules/vehicle.mjs";

function daemonic(rating) {
  return { type: "vehicleTrait", system: { rating, effects: { daemonicAbsorb: true } } };
}

describe("prepareVehicleDerived — Демонический (X)", () => {
  it("рейтинг агрегируется в traitFlags.daemonicAbsorb", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([daemonic(5)], system);
    expect(system.derived.traitFlags.daemonicAbsorb).toBe(5);
  });

  it("без Черты — 0", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([], system);
    expect(system.derived.traitFlags.daemonicAbsorb).toBe(0);
  });

  it("несколько предметов — берётся максимум", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([daemonic(3), daemonic(7)], system);
    expect(system.derived.traitFlags.daemonicAbsorb).toBe(7);
  });
});
