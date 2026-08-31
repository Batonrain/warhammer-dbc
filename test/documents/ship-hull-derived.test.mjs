// test/documents/ship-hull-derived.test.mjs
//
// Корпус — отдельный тип предмета ("shipHull"), не узел ("component") среди
// прочих: выбирается пикером в шапке (sheets/hull-picker.mjs), а расчёт листа
// корабля (_prepareShipData) обязан по-прежнему брать от него SP/Пространство/
// Мощность/Прочность/характеристики и авто-свойства (Aspects) — как раньше
// брал от узла с kind:"hull".

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function shipHull(system = {}) {
  return {
    id: "hull1", name: "Тиамат / Тиамат", type: "shipHull",
    system: {
      hullClass: "Линкоры", sp: 80, rarity: 0, quality: "common",
      qualityPicks: [], qualityCustom: false, shipProps: [],
      hull: { spaceMax: 130, powerGen: 5, turnArc: "45°", weaponCapacity: "1НП, 1ПБ, 1ЛБ", hullIntegrity: 160 },
      chars: { speed: 4, manoeuvrability: -20, detection: 10, voidShields: 0, armour: 40, turretRating: 4 },
      ...system
    }
  };
}

function component(system = {}) {
  return {
    id: "c1", name: "Узел", type: "component",
    system: { kind: "supplemental", power: 0, space: 0, sp: 0, quality: "common", qualityPicks: [], shipProps: [], ...system }
  };
}

/** Корабль со схемой по умолчанию: расчёт листа без живого документа Foundry. */
function shipWith(itemList = []) {
  const system = new ACTOR_DATA_MODELS.ship({}).toObject();
  const items = Object.assign([...itemList], {
    filter: Array.prototype.filter.bind(itemList),
    find:   Array.prototype.find.bind(itemList),
    get: id => itemList.find(i => i.id === id) ?? null
  });
  const actorLike = Object.assign(Object.create(WarhammerActor.prototype),
    { type: "ship", name: "«Мизерикордия»", system, items, getFlag: () => undefined });
  actorLike.prepareDerivedData();
  return system;
}

describe("Корпус корабля — производные данные", () => {
  it("SP Корпуса входит в потраченный бюджет очков корабля", () => {
    const system = shipWith([shipHull()]);
    expect(system.derived.sp.spent).toBe(80);
  });

  it("Пространство/Мощность/Прочность/поворот/оснащённость — от Корпуса", () => {
    const system = shipWith([shipHull()]);
    expect(system.derived.space.max).toBe(130);
    expect(system.derived.power.generated).toBe(5);
    expect(system.derived.hullIntegrityMax).toBe(160);
    expect(system.derived.turnArc).toBe("45°");
    expect(system.derived.weaponCapacity).toBe("1НП, 1ПБ, 1ЛБ");
  });

  it("Характеристики корабля (SPD/MN/DT/ARM/TR) — от Корпуса", () => {
    const system = shipWith([shipHull()]);
    expect(system.derived.chars.speed).toBe(4);
    expect(system.derived.chars.manoeuvrability).toBe(-20);
    expect(system.derived.chars.armour).toBe(40);
    expect(system.derived.chars.turretRating).toBe(4);
  });

  it("hasHull/hullName отражают предмет-Корпус", () => {
    const withHull = shipWith([shipHull()]);
    expect(withHull.derived.hasHull).toBe(true);
    expect(withHull.derived.hullName).toBe("Тиамат / Тиамат");

    const noHull = shipWith([]);
    expect(noHull.derived.hasHull).toBe(false);
    expect(noHull.derived.hullIntegrityMax).toBe(0);
  });

  it("авто-свойство (Aspects) Корпуса правит производную характеристику (fast +X)", () => {
    const system = shipWith([shipHull({ shipProps: [{ key: "fast", rating: 3 }] })]);
    expect(system.derived.chars.speed).toBe(4 + 3);
  });

  it("узел типа component больше не подхватывается как Корпус, даже с legacy kind:\"hull\"", () => {
    // Старые данные могли содержать узел kind:"hull" — расчёт больше не ищет
    // Корпус среди узлов, только среди предметов типа shipHull.
    const system = shipWith([component({ kind: "hull", sp: 999 })]);
    expect(system.derived.hasHull).toBe(false);
    expect(system.derived.sp.spent).toBe(999); // сам узел всё равно тратит SP как обычный узел
  });
});

describe("Ship-wide боевые директивы (wdbc-qhwb)", () => {
  it("deadlyRamming: формулы кубика с узлов+Корпуса копятся в derived.ramDice", () => {
    const system = shipWith([
      shipHull({ shipProps: [{ key: "deadlyRamming", rating: "1d10" }] }),
      component({ shipProps: [{ key: "deadlyRamming", rating: "1d5" }] })
    ]);
    expect(system.derived.ramDice).toEqual(["1d10", "1d5"]);
  });

  it("deadlyRamming без rating (пустой бэкфилл) не попадает в ramDice", () => {
    const system = shipWith([component({ shipProps: [{ key: "deadlyRamming" }] })]);
    expect(system.derived.ramDice).toEqual([]);
  });

  it("devastating(X;Y): суммируется по типу узла Y в derived.devastatingByType", () => {
    const system = shipWith([
      component({ shipProps: [{ key: "devastating", rating: 2, rating2: "macrobattery" }] }),
      component({ shipProps: [{ key: "devastating", rating: 1, rating2: "macrobattery" }] }),
      component({ shipProps: [{ key: "devastating", rating: 3, rating2: "lance" }] })
    ]);
    expect(system.derived.devastatingByType).toEqual({ macrobattery: 3, lance: 3 });
  });

  it("orbitalStrike: суммируется ship-wide (не только с оружия)", () => {
    const system = shipWith([
      component({ kind: "augur", shipProps: [{ key: "orbitalStrike", rating: 5 }] }),
      component({ kind: "bridge", shipProps: [{ key: "orbitalStrike", rating: 10 }] })
    ]);
    expect(system.derived.orbitalStrike).toBe(15);
  });

  it("узел damaged/destroyed не вносит ship-wide боевые директивы (как и обычные auto)", () => {
    const system = shipWith([
      component({ status: "destroyed", shipProps: [{ key: "orbitalStrike", rating: 10 }] })
    ]);
    expect(system.derived.orbitalStrike).toBe(0);
  });
});
