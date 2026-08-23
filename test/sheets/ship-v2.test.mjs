// test/sheets/ship-v2.test.mjs
//
// Лист корабля на ApplicationV2 (wdbc-ff4.10.9). Самый большой лист эпика:
// семь вкладок, 37 действий, 13 диалогов. Общий договор с шаблоном — в
// describeV2Sheet; здесь то, что своё: сборка контекста.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerShipSheet } from "../../module/sheets/ship-sheet.mjs";

describeV2Sheet(WarhammerShipSheet, {
  sheet: "module/sheets/ship-sheet.mjs",
  template: "templates/actor/ship-sheet.hbs"
});

function component(over = {}) {
  const { system = {}, ...rest } = over;
  return {
    id: "c1", name: "Узел", img: "c.png", type: "component",
    system: { kind: "supplemental", power: 1, space: 1, sp: 0, ...system },
    ...rest
  };
}

function shipActor(list = []) {
  const items = [...list];
  items.filter = Array.prototype.filter.bind(items);
  items.some   = Array.prototype.some.bind(items);
  items.get    = id => items.find(i => i.id === id) ?? null;
  return {
    name: "«Мизерикордия»", img: "s.png", isOwner: true, items,
    system: {
      shipType: "raider", hullIntegrity: { value: 30 },
      crew: { population: 100, morale: 100, rating: "competent" },
      officers: [], distortions: [], supplies: { value: 3 },
      derived: { chars: {}, hullIntegrityMax: 40 }
    },
    update: async () => {}
  };
}

function sheetLike(actor) {
  return Object.assign(Object.create(WarhammerShipSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "overview" } });
}

const ctxOf = actor => WarhammerShipSheet.prototype._prepareContext.call(sheetLike(actor), {});

beforeEach(() => { globalThis.game.user.isGM = true; });

describe("_prepareContext", () => {
  it("вкладка по умолчанию — Обзор", async () => {
    const ctx = await ctxOf(shipActor());

    expect(ctx.tab).toBe("overview");
    expect(ctx.hasHangar).toBe(false);
  });

  // Узлы сортируются просто по имени: Корпус больше не среди них (см. ниже).
  it("узлы идут по алфавиту", async () => {
    const ctx = await ctxOf(shipActor([
      component({ id: "c2", name: "Ауспики", system: { kind: "augur" } }),
      component({ id: "c1", name: "Жизнеобеспечение", system: { kind: "lifeSustainer" } })
    ]));

    expect(ctx.components.map(c => c.name)).toEqual(["Ауспики", "Жизнеобеспечение"]);
  });

  // Корпус — отдельный тип предмета (не узел): выбирается пикером в шапке
  // (sheets/hull-picker.mjs), не попадает в список Узлов, виден как hullSlot.
  it("Корпус — не узел: своя слот в шапке, вне списка Узлов", async () => {
    const ctx = await ctxOf(shipActor([
      component({ id: "c2", name: "Ауспики", system: { kind: "augur" } }),
      { id: "h1", name: "Тиамат / Тиамат", img: "h.png", type: "shipHull",
        system: { hullClass: "Линкоры", sp: 80 } }
    ]));

    expect(ctx.components.map(c => c.name)).toEqual(["Ауспики"]);
    expect(ctx.hullSlot).toEqual({ id: "h1", img: "h.png", name: "Тиамат / Тиамат", hullClass: "Линкоры" });
  });

  it("hullSlot — null, если Корпус не выбран", async () => {
    const ctx = await ctxOf(shipActor());
    expect(ctx.hullSlot).toBeNull();
  });

  it("ангар появляется только с отсеком МЛА, вместимость — по S отсеков", async () => {
    const bay = component({ id: "b1", name: "Ангар", system: { kind: "weapon", weapon: { wType: "bay", strength: 2 } } });
    const ctx = await ctxOf(shipActor([bay]));

    expect(ctx.hasHangar).toBe(true);
    expect(ctx.hangar.capacity).toBe(2);
    expect(ctx.hangar.storageMax).toBe(6);      // до трёх эскадрилий на очко S
    // Отсек — не орудие: стрелять из ангара нельзя, вылет идёт Длительным Действием.
    expect(ctx.weapons).toEqual([]);
  });

  it("припасы корабля не занимают трюм", async () => {
    const cargo = (id, shipSupply) => ({
      id, name: `Партия ${id}`, img: "c.png", type: "cargo",
      system: { cargoType: "fuel", lc: 5, quantity: 2, shipSupply }
    });
    const ctx = await ctxOf(shipActor([cargo("g1", false), cargo("g2", true)]));

    expect(ctx.cargoGroups).toHaveLength(1);
    expect(ctx.cargoGroups[0].units).toBe(4);   // считаются обе партии
    expect(ctx.cargoGroups[0].lcTotal).toBe(10); // а объём — только не-припасов
  });
});
