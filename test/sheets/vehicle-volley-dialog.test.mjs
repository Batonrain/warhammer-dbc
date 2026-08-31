// test/sheets/vehicle-volley-dialog.test.mjs
//
// wdbc-y33b (доводка): _showVolleyDialog — тратит полное действие оператора
// станции (через resolveVolleyAction), затем открывает стрельбу из первого
// орудия станции с преимуществом Прицеливания (+10), остальные — чат-заметкой.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { WarhammerVehicleSheet } from "../../module/sheets/vehicle-sheet.mjs";

function sheetLike(actor) {
  return Object.assign(Object.create(WarhammerVehicleSheet.prototype), { actor });
}

function weaponAt(stationId, id, name) {
  return { id, name, type: "weapon", system: { weaponClass: "heavy", rof_single: 1, vehicleMount: { stationId, mount: "turret", hArc: "360°" } } };
}

function vehicle(items, stations) {
  return {
    name: "Хищник", uuid: "Actor.vehicle", items,
    system: { stations, derived: {} },
    getActiveTokens: () => []
  };
}

const realFromUuid = globalThis.fromUuid;
beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; });

describe("_showVolleyDialog: гейт", () => {
  it("нет орудий на станции — предупреждение", async () => {
    const v = vehicle([], [{ id: "s1", role: "gunner", uuid: "Actor.gunner" }]);
    await sheetLike(v)._showVolleyDialog("s1");
    expect(captured.warnings.at(-1)).toContain("нет орудий");
  });

  it("не хватает ОД у оператора — предупреждение, стрельба не открывается", async () => {
    globalThis.fromUuid = async () => ({
      uuid: "Actor.gunner", type: "character", name: "Стрелок",
      system: { actionPoints: { value: 0, max: 2 } }, update: async () => {}
    });
    globalThis.game.combat = { started: true };
    const items = [weaponAt("s1", "w1", "Автопушка")];
    const v = vehicle(items, [{ id: "s1", role: "gunner", uuid: "Actor.gunner" }]);

    await sheetLike(v)._showVolleyDialog("s1");

    expect(captured.warnings.at(-1)).toContain("не хватает ОД");
    expect(captured.dialog).toBeFalsy();
  });
});

describe("_showVolleyDialog: успех", () => {
  it("одно орудие — сразу открывает стрельбу с Прицеливанием, без чат-заметки об «остальных»", async () => {
    globalThis.fromUuid = async () => ({
      uuid: "Actor.gunner", type: "character", name: "Стрелок",
      system: { actionPoints: { value: 2, max: 2 } }, update: async () => {}
    });
    globalThis.game.combat = { started: true };
    const items = [weaponAt("s1", "w1", "Автопушка")];
    items.get = id => items.find(i => i.id === id) ?? null;
    const v = vehicle(items, [{ id: "s1", role: "gunner", uuid: "Actor.gunner" }]);

    await sheetLike(v)._showVolleyDialog("s1");

    expect(captured.dialog.window.title).toContain("Автопушка");
    expect(captured.dialog.content).toContain('value="10"'); // aimBonus предзаполнен
    expect(captured.dialog.content).toContain("Залп: первое орудие");
    expect(captured.chat).toEqual([]); // нет "остальных" орудий — чат-заметка не нужна
  });

  it("несколько орудий — чат-заметка перечисляет остальные, открывает первое", async () => {
    globalThis.fromUuid = async () => ({
      uuid: "Actor.gunner", type: "character", name: "Стрелок",
      system: { actionPoints: { value: 2, max: 2 } }, update: async () => {}
    });
    globalThis.game.combat = { started: true };
    const items = [weaponAt("s1", "w1", "Автопушка"), weaponAt("s1", "w2", "Спаренный болтер")];
    items.get = id => items.find(i => i.id === id) ?? null;
    const v = vehicle(items, [{ id: "s1", role: "gunner", uuid: "Actor.gunner" }]);

    await sheetLike(v)._showVolleyDialog("s1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Автопушка");
    expect(card).toContain("Спаренный болтер");
    expect(card).toContain("без доп. траты ОД");
    expect(captured.dialog.window.title).toContain("Автопушка");
  });
});
