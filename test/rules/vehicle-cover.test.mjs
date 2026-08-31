// test/rules/vehicle-cover.test.mjs
//
// wdbc-y33b (доводка): Закрытая/Открытая(X) — укрытие экипажа/пассажиров
// ВНУТРИ техники, тот же смысл, что coverBonusForShot от местности —
// отрицательный штраф к порогу атакующего. stationOf() — обратный поиск
// «в какой технике сидит этот актор», которого раньше не было вовсе.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { prepareVehicleDerived, stationOf, vehicleCoverMod } from "../../module/rules/vehicle.mjs";

function openTopped(rating) {
  return { type: "vehicleTrait", system: { rating, effects: { openTopped: true } } };
}
function enclosed() {
  return { type: "vehicleTrait", system: { rating: 0, effects: { enclosed: true } } };
}

function vehicle(items, { side = 10 } = {}) {
  const system = { chassis: { type: "tracked", spd: 6 }, armour: { front: 12, side, rear: 8 } };
  prepareVehicleDerived(items, system);
  return { type: "vehicle", uuid: "Actor.veh", system: { ...system, stations: [] } };
}

const gunner = { uuid: "Actor.gunner", type: "character" };

describe("prepareVehicleDerived — рейтинг Открытой(X)", () => {
  it("рейтинг агрегируется в traitFlags.openToppedRating", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([openTopped(0.5)], system);
    expect(system.derived.traitFlags.openToppedRating).toBe(0.5);
  });

  it("без Черты — 0", () => {
    const system = { chassis: { type: "tracked", spd: 6 } };
    prepareVehicleDerived([], system);
    expect(system.derived.traitFlags.openToppedRating).toBe(0);
  });
});

describe("stationOf — обратный поиск «персонаж → техника»", () => {
  it("не сидит ни в какой технике — null", () => {
    const veh = vehicle([]);
    veh.system.stations = [{ id: "s1", role: "gunner", uuid: "Actor.other" }];
    expect(stationOf(gunner.uuid, [veh])).toBeNull();
  });

  it("находит технику и место по uuid", () => {
    const veh = vehicle([]);
    const station = { id: "s1", role: "gunner", uuid: gunner.uuid };
    veh.system.stations = [station];
    const hit = stationOf(gunner.uuid, [veh]);
    expect(hit.vehicle).toBe(veh);
    expect(hit.station).toBe(station);
  });

  it("пустой uuid — null сразу, без перебора", () => {
    expect(stationOf("", [vehicle([])])).toBeNull();
  });
});

describe("vehicleCoverMod — Закрытая (полное укрытие)", () => {
  it("−АР Бортовой стороны", () => {
    const veh = vehicle([enclosed()], { side: 14 });
    veh.system.stations = [{ id: "s1", uuid: gunner.uuid }];
    expect(vehicleCoverMod(gunner, [veh])).toBe(-14);
  });

  it("АР стороны 0 — укрытия нет (нечем прикрыть)", () => {
    const veh = vehicle([enclosed()], { side: 0 });
    veh.system.stations = [{ id: "s1", uuid: gunner.uuid }];
    expect(vehicleCoverMod(gunner, [veh])).toBe(0);
  });
});

describe("vehicleCoverMod — Открытая(X) по рейтингу", () => {
  it("рейтинг 0 — нет укрытия", () => {
    const veh = vehicle([openTopped(0)], { side: 10 });
    veh.system.stations = [{ id: "s1", uuid: gunner.uuid }];
    expect(vehicleCoverMod(gunner, [veh])).toBe(0);
  });

  it("рейтинг ½ — приближение к половине АР (окр.▲)", () => {
    const veh = vehicle([openTopped(0.5)], { side: 11 });
    veh.system.stations = [{ id: "s1", uuid: gunner.uuid }];
    expect(vehicleCoverMod(gunner, [veh])).toBe(-6); // ceil(11/2)=6
  });

  it("рейтинг 1 — полное укрытие", () => {
    const veh = vehicle([openTopped(1)], { side: 10 });
    veh.system.stations = [{ id: "s1", uuid: gunner.uuid }];
    expect(vehicleCoverMod(gunner, [veh])).toBe(-10);
  });
});

describe("vehicleCoverMod — не в технике", () => {
  it("возвращает 0", () => {
    expect(vehicleCoverMod(gunner, [vehicle([])])).toBe(0);
  });
});
