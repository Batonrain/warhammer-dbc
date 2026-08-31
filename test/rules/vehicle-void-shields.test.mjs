// test/rules/vehicle-void-shields.test.mjs
//
// wdbc-y33b: «Пустотные Щиты (X)» — массив по X отдельных щитов (АР 30 + 20
// Структуры каждый), длину рабочего массива синхронизирует
// prepareVehicleDerived под текущий рейтинг Черты.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { prepareVehicleDerived } from "../../module/rules/vehicle.mjs";

function voidShields(rating) {
  return {
    type: "vehicleTrait",
    system: { rating, effects: { voidShields: true } }
  };
}

describe("prepareVehicleDerived — Пустотные Щиты (X)", () => {
  it("нет Черты — voidShields пуст", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([], system);
    expect(system.voidShields).toEqual([]);
  });

  it("новая Черта рейтинга 3 — 3 новых щита, все полные (20)", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([voidShields(3)], system);
    expect(system.voidShields).toEqual([20, 20, 20]);
  });

  it("сохраняет уже накопленные значения повреждённых щитов", () => {
    const system = { chassis: { type: "tracked", spd: 6 }, voidShields: [12, 0, 20] };
    prepareVehicleDerived([voidShields(3)], system);
    expect(system.voidShields).toEqual([12, 0, 20]);
  });

  it("рейтинг вырос — новые щиты добавляются полными, старые не трогаются", () => {
    const system = { chassis: { type: "tracked", spd: 6 }, voidShields: [12] };
    prepareVehicleDerived([voidShields(2)], system);
    expect(system.voidShields).toEqual([12, 20]);
  });

  it("значение зажимается в диапазон 0-20", () => {
    const system = { chassis: { type: "tracked", spd: 6 }, voidShields: [-5, 99] };
    prepareVehicleDerived([voidShields(2)], system);
    expect(system.voidShields).toEqual([0, 20]);
  });
});
