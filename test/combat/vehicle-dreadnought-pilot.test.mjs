// test/combat/vehicle-dreadnought-pilot.test.mjs
//
// wdbc-a7s: пилот Дредноута (Книга Машин, стр. 57) — при ≥½W.b пилота (окр.▲)
// непоглощённого урона по машине пилот получает тот же урон в свои Раны, без
// брони и T.b (саркофаг лишь передаёт удар). module/combat/vehicle.mjs::
// applyDamageToVehicle — pilotUuidOf/isDreadnought/pilotDamageThreshold
// (module/rules/dreadnought.mjs) уже были готовы как чистая математика, но
// это первый тест, проверяющий саму проводку через fromUuid/applyWoundLoss.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToVehicle } from "../../module/combat/vehicle.mjs";

function dreadnought(pilotUuid = "Actor.pilot-1", overrides = {}) {
  return {
    type: "vehicle",
    name: "Кастраферум",
    system: {
      vehicleClass: "Дредноут",
      armour: { side: 0 },
      structure: { value: 20, critical: 0 },
      stations: [{ role: "pilot", uuid: pilotUuid }],
      derived: { traitFlags: {} },
      ...overrides
    },
    getActiveTokens: () => [],
    update: async () => {}
  };
}

function pilot(wpBonus = 4) {
  const updates = [];
  return {
    uuid: "Actor.pilot-1", name: "Сор Шаати",
    system: { characteristics: { wp: { bonus: wpBonus } }, wounds: { value: 20, critical: 0, max: 20, ablativeMax: 0 } },
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

const origFromUuid = globalThis.fromUuid;

beforeEach(() => { resetCaptured(); captured.dice = [50]; });
afterEach(() => { globalThis.fromUuid = origFromUuid; });

describe("Резонанс саркофага: урон по Дредноуту достаёт пилота (wdbc-a7s)", () => {
  it("непоглощённый урон ≥ порога (½W.b) — пилот получает тот же урон в Раны", async () => {
    const p = pilot(4); // порог = ceil(4/2) = 2
    globalThis.fromUuid = async () => p;
    const actor = dreadnought();

    await applyDamageToVehicle(actor, { rawDamage: 5, side: "side" });

    expect(p._updates).toEqual([{ "system.wounds.value": 15, "system.wounds.critical": 0, "system.wounds.firstAidUsed": false }]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Резонанс саркофага");
    expect(card).toContain("Сор Шаати");
  });

  it("непоглощённый урон ниже порога — пилот не задет", async () => {
    const p = pilot(4); // порог = 2
    globalThis.fromUuid = async () => p;
    const actor = dreadnought();

    await applyDamageToVehicle(actor, { rawDamage: 1, side: "side" });

    expect(p._updates).toEqual([]);
    expect(captured.chat.at(-1).content).not.toContain("Резонанс саркофага");
  });

  it("не Дредноут (обычная техника) — пилот не задет, даже с местом pilot", async () => {
    const p = pilot(4);
    globalThis.fromUuid = async () => p;
    const actor = dreadnought("Actor.pilot-1", { vehicleClass: "Транспорт" });

    await applyDamageToVehicle(actor, { rawDamage: 5, side: "side" });

    expect(p._updates).toEqual([]);
  });

  it("пилот не назначен (пустое место) — не падает, урон машине проходит как обычно", async () => {
    globalThis.fromUuid = async () => { throw new Error("не должно вызываться без uuid"); };
    const actor = dreadnought("");

    await applyDamageToVehicle(actor, { rawDamage: 5, side: "side" });

    expect(captured.chat.at(-1).content).not.toContain("Резонанс саркофага");
  });
});
