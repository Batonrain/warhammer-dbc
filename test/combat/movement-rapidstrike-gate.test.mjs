// test/combat/movement-rapidstrike-gate.test.mjs
//
// Стойка Частокол (стр. 15, wdbc-x1nz.2.66.9): «нельзя Натиск и Бег» — раньше
// noCharge гейтил только пилюлю Базы в диалоге атаки (module/sheets/attack/
// selection.mjs), отдельные кнопки HUD Движения «Натиск»/«Бег»
// (declareCharge/declareRun) не проверяли Стойку вовсе.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { declareCharge, declareRun } from "../../module/combat/movement-actions.mjs";

function actorWith(stance) {
  return {
    name: "Копейщик", items: [],
    system: { meleeStance: stance, conditions: {}, movement: { charge: 6, run: 12 } },
    update: async () => {},
    setFlag: async () => {},
    getFlag: () => undefined
  };
}

beforeEach(resetCaptured);

describe("Стойка Частокол блокирует Натиск и Бег на HUD Движения", () => {
  it("declareCharge в Частоколе — предупреждение, база не меняется", async () => {
    const actor = actorWith("rapidstrike");
    await declareCharge(actor);
    expect(captured.warnings.some(w => w.includes("Частокол"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("declareRun в Частоколе — предупреждение, ОД не списаны", async () => {
    const actor = actorWith("rapidstrike");
    await declareRun(actor);
    expect(captured.warnings.some(w => w.includes("Частокол"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("declareCharge в Стандартной Стойке — работает как обычно (регресс)", async () => {
    const actor = actorWith("standard");
    await declareCharge(actor);
    expect(captured.warnings).toHaveLength(0);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("declareRun в Стандартной Стойке — работает как обычно (регресс)", async () => {
    const actor = actorWith("standard");
    await declareRun(actor);
    expect(captured.warnings).toHaveLength(0);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  // Защитная Стойка (wdbc-x1nz.2.66.6) запрещает только Натиск, не Бег.
  it("declareRun в Защитной Стойке — по-прежнему доступен (noCharge, не noRun)", async () => {
    const actor = actorWith("defensive");
    await declareRun(actor);
    expect(captured.warnings).toHaveLength(0);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("declareCharge в Защитной Стойке — тоже заблокирован (уже было, регресс)", async () => {
    const actor = actorWith("defensive");
    await declareCharge(actor);
    expect(captured.warnings.some(w => w.includes("Защитная"))).toBe(true);
  });
});
