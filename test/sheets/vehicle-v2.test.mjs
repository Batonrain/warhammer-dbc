// test/sheets/vehicle-v2.test.mjs
//
// Лист техники на ApplicationV2 (wdbc-ff4.10.4). Общий договор с шаблоном —
// в describeV2Sheet; здесь то, что своё у этого листа: контекст, права и
// действия, которые доступны игроку-не-владельцу.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerVehicleSheet } from "../../module/sheets/vehicle-sheet.mjs";

describeV2Sheet(WarhammerVehicleSheet, {
  sheet: "module/sheets/vehicle-sheet.mjs",
  template: "templates/actor/vehicle-sheet.hbs"
});

function vehicleActor(over = {}) {
  const items = [];
  items.filter = Array.prototype.filter.bind(items);
  items.get = id => items.find(i => i.id === id) ?? null;
  return {
    name: "«Носорог»", img: "v.png", isOwner: true, items,
    system: {
      chassis: { type: "tracked" },
      structure: { value: 20, max: 40 },
      stations: [], damageStates: [], derived: {}
    },
    update: async () => {},
    ...over
  };
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerVehicleSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "overview" } }, extra);
}

beforeEach(() => { globalThis.game.user.isGM = true; });

describe("_prepareContext", () => {
  it("даёт шаблону шкалу Структуры и вкладку", async () => {
    const actor = vehicleActor();
    const ctx = await WarhammerVehicleSheet.prototype._prepareContext.call(sheetLike(actor), {});

    expect(ctx.actor).toBe(actor);
    expect(ctx.system).toBe(actor.system);
    expect(ctx.tab).toBe("overview");
    expect(ctx.structPct).toBe(50);
    expect(ctx.structLevel).toBe("warn");
    expect(ctx.structStatus).toBe("ПОВРЕЖДЕНА");
  });

  it("незаданная Структура не делит на ноль", async () => {
    const actor = vehicleActor({ system: { structure: { value: 0, max: 0 }, derived: {} } });
    const ctx = await WarhammerVehicleSheet.prototype._prepareContext.call(sheetLike(actor), {});
    expect(ctx.structPct).toBe(0);
    expect(ctx.structLevel).toBe("na");
  });
});

// Игрок-не-владелец техники должен уметь сесть в неё и выйти, поэтому два
// действия из карты намеренно не обёрнуты в whenEditable.
describe("права", () => {
  const actions = WarhammerVehicleSheet.DEFAULT_OPTIONS.actions;

  it("правящие действия на нередактируемом листе молчат", async () => {
    const calls = [];
    const actor = vehicleActor({ update: async u => calls.push(u) });
    const sheet = sheetLike(actor, { isEditable: false });
    await actions.stateAdd.call(sheet);
    await actions.stationsAdd.call(sheet);
    expect(calls).toEqual([]);
  });

  it("выход с места доступен и без прав на правку листа", async () => {
    const stations = [{ id: "s1", role: "gunner", uuid: "", name: "Ганнер", img: "" }];
    const actor = vehicleActor({ system: { stations, derived: {}, structure: {} } });
    const persisted = [];
    const sheet = sheetLike(actor, { isEditable: false, _persistStations: async s => persisted.push(s) });

    await actions.stationClear.call(sheet, {}, { closest: () => ({ dataset: { stationId: "s1" } }) });

    expect(persisted).toHaveLength(1);
    expect(persisted[0][0]).toMatchObject({ id: "s1", uuid: "", name: "" });
  });
});

describe("состояния машины", () => {
  it("удаление снимает только выбранное состояние", async () => {
    const states = [{ id: "a" }, { id: "b" }];
    const upd = [];
    const actor = vehicleActor({
      system: { damageStates: states, derived: {}, structure: {} },
      update: async u => upd.push(u)
    });
    await WarhammerVehicleSheet.DEFAULT_OPTIONS.actions.stateDel
      .call(sheetLike(actor), {}, { closest: () => ({ dataset: { stateId: "a" } }) });

    expect(upd[0]["system.damageStates"]).toEqual([{ id: "b" }]);
  });
});
