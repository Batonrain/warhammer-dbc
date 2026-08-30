// test/rules/vehicle-sidecar-structure.test.mjs
//
// wdbc-8nz6: «Коляска (X) / Sidecar (X)» даёт байку +X Структуры (стр. 478).
// effects.sidecarStructure — ФЛАГ (как spdDamageReduce/deflectorShield), X
// читается из рейтинга Черты на предмете.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { prepareVehicleDerived } from "../../module/rules/vehicle.mjs";

function sidecar(rating) {
  return {
    type: "vehicleTrait",
    system: { rating, effects: { sidecarStructure: true } }
  };
}

describe("prepareVehicleDerived — Коляска (X) прибавляет Структуру байку", () => {
  it("рейтинг 3 добавляет 3 к максимуму Структуры", () => {
    const system = { chassis: { type: "wheeled", spd: 8 }, structure: { value: 6, max: 6, critical: 0 } };
    prepareVehicleDerived([sidecar(3)], system);
    expect(system.structure.max).toBe(9);
    expect(system.structure.value).toBe(6); // текущее значение не трогается
  });

  it("без Черты максимум Структуры не меняется", () => {
    const system = { chassis: { type: "wheeled", spd: 8 }, structure: { value: 6, max: 6, critical: 0 } };
    prepareVehicleDerived([], system);
    expect(system.structure.max).toBe(6);
  });
});
