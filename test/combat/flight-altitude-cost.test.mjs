// test/combat/flight-altitude-cost.test.mjs
//
// Стр. 30, wdbc-x1nz.2.34: Смена Высоты — landed↔ground свободное действие,
// ground↔low полудействие, low↔high полное действие; перепрыгнуть через
// уровень одним действием книга не даёт. Раньше «Установить высоту» не
// списывала ОД вовсе и не гейтила соседство уровней.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showFlightDialog, _altitudeChangeCost } from "../../module/combat/movement-actions.mjs";

function traitItem(name) { return { type: "trait", name, system: {} }; }

function actorWith({ altitude = "landed", actionPoints = { value: 2, max: 2 } } = {}) {
  const tokenDocs = [{ elevation: 0, update: async d => Object.assign(tokenDocs[0], d) }];
  const store = {};
  const doc = {
    name: "Подставной", type: "character", items: [traitItem("Flyer (2×A.b)")],
    system: { movement: { altitude }, actionPoints },
    getActiveTokens: () => tokenDocs,
    __tokenDocs: tokenDocs
  };
  doc.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return doc;
}

beforeEach(resetCaptured);
afterEach(() => { globalThis.game.combat = undefined; });

describe("_altitudeChangeCost", () => {
  it("landed↔ground — свободное действие (0)", () => {
    expect(_altitudeChangeCost("landed", "ground")).toBe(0);
    expect(_altitudeChangeCost("ground", "landed")).toBe(0);
  });
  it("ground↔low — полудействие (1)", () => {
    expect(_altitudeChangeCost("ground", "low")).toBe(1);
    expect(_altitudeChangeCost("low", "ground")).toBe(1);
  });
  it("low↔high — полное действие (2)", () => {
    expect(_altitudeChangeCost("low", "high")).toBe(2);
    expect(_altitudeChangeCost("high", "low")).toBe(2);
  });
  it("прыжок через уровень (landed↔low, ground↔high, landed↔high) — недопустимо (null)", () => {
    expect(_altitudeChangeCost("landed", "low")).toBeNull();
    expect(_altitudeChangeCost("ground", "high")).toBeNull();
    expect(_altitudeChangeCost("landed", "high")).toBeNull();
  });
  it("тот же уровень — 0 (не задействуется гейтом «недопустимо», обрабатывается отдельно)", () => {
    expect(_altitudeChangeCost("ground", "ground")).toBeNull(); // diff 0 !== 1 — не «переход» вовсе
  });
});

describe("showFlightDialog: цена и соседство Высоты (wdbc-x1nz.2.34)", () => {
  it("landed→ground вне боя — проходит, ОД не проверяются (не в бою)", async () => {
    const actor = actorWith({ altitude: "landed" });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "ground" }));
    expect(actor.system.movement.altitude).toBe("ground");
  });

  it("landed→high напрямую — блокируется предупреждением, altitude не меняется", async () => {
    const actor = actorWith({ altitude: "landed" });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "high" }));
    expect(captured.warnings.some(w => w.includes("соседний"))).toBe(true);
    expect(actor.system.movement.altitude).toBe("landed");
  });

  it("в бою: ground→low списывает 1 ОД (полудействие)", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorWith({ altitude: "ground", actionPoints: { value: 2, max: 2 } });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "low" }));
    expect(actor.system.actionPoints.value).toBe(1);
    expect(actor.system.movement.altitude).toBe("low");
  });

  it("в бою: low→high списывает 2 ОД (полное действие)", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorWith({ altitude: "low", actionPoints: { value: 2, max: 2 } });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "high" }));
    expect(actor.system.actionPoints.value).toBe(0);
  });

  it("в бою: landed→ground свободное действие — ОД не трогает", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorWith({ altitude: "landed", actionPoints: { value: 2, max: 2 } });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "ground" }));
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.system.movement.altitude).toBe("ground");
  });

  it("в бою без ОД на полудействие — блокируется, altitude не меняется", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorWith({ altitude: "ground", actionPoints: { value: 0, max: 2 } });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "low" }));
    expect(actor.system.movement.altitude).toBe("ground");
  });

  it("та же высота (пересинхронизация elevation) — не гейтится, ОД не тратит", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorWith({ altitude: "ground", actionPoints: { value: 2, max: 2 } });
    actor.__tokenDocs[0].elevation = 99; // рассинхронизировано
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "ground" }));
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.__tokenDocs[0].elevation).toBe(0); // пересинхронизировалось на Приземную
  });
});
