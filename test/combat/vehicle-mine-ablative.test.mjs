// test/combat/vehicle-mine-ablative.test.mjs
//
// wdbc-bxw6: Аблативная Структура (Минный Плуг — +20 против мин,
// system.structure.ablative/.ablativeMax) — бонус AP только когда попадание
// засчитано как «от мины» (damageData.fromMine — детектора мин в конвейере
// урона нет, флаг ставит вызывающая сторона), теряет ровно 1 заряд с
// попадания, независимо от нанесённого урона (module/combat/vehicle.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToVehicle } from "../../module/combat/vehicle.mjs";

function vehicle(overrides = {}) {
  const updates = [];
  const system = {
    armour: { front: 10 },
    structure: { value: 20, critical: 0, ablative: 0, ablativeMax: 0 },
    derived: { traitFlags: {} },
    ...overrides
  };
  return {
    type: "vehicle",
    name: "Химера",
    system,
    getActiveTokens: () => [],
    update: async data => {
      updates.push(data);
      if (data["system.structure.value"]    !== undefined) system.structure.value    = data["system.structure.value"];
      if (data["system.structure.critical"] !== undefined) system.structure.critical = data["system.structure.critical"];
      if (data["system.structure.ablative"] !== undefined) system.structure.ablative = data["system.structure.ablative"];
    },
    _updates: updates
  };
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [50];
});

describe("Аблативная Структура: бонус AP только при fromMine, теряет 1/попадание", () => {
  it("без fromMine — аблатив не действует, даже если пул полон", async () => {
    const actor = vehicle({ structure: { value: 20, critical: 0, ablative: 20, ablativeMax: 20 } });
    await applyDamageToVehicle(actor, { rawDamage: 15, side: "front" });
    expect(actor._updates.some(u => "system.structure.ablative" in u)).toBe(false);
    expect(actor.system.structure.value).toBe(15); // 15 - AP10 = 5 в Структуру
  });

  it("с fromMine — аблатив добавляется к AP лобовой брони", async () => {
    const actor = vehicle({ structure: { value: 20, critical: 0, ablative: 20, ablativeMax: 20 } });
    // AP 10 + аблатив 20 = 30 >> урон 25 → поглощено полностью
    await applyDamageToVehicle(actor, { rawDamage: 25, side: "front", fromMine: true });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Урон поглощён");
  });

  it("с fromMine — теряет РОВНО 1 заряд, даже если урон поглощён целиком", async () => {
    const actor = vehicle({ structure: { value: 20, critical: 0, ablative: 20, ablativeMax: 20 } });
    await applyDamageToVehicle(actor, { rawDamage: 5, side: "front", fromMine: true });
    expect(actor.system.structure.ablative).toBe(19);
  });

  it("истощённый (0) аблатив — update аблатива не шлётся", async () => {
    const actor = vehicle({ structure: { value: 20, critical: 0, ablative: 0, ablativeMax: 20 } });
    await applyDamageToVehicle(actor, { rawDamage: 5, side: "front", fromMine: true });
    expect(actor._updates.some(u => "system.structure.ablative" in u)).toBe(false);
  });

  it("сообщение в чат показывает остаток аблатива после попадания", async () => {
    const actor = vehicle({ structure: { value: 20, critical: 0, ablative: 20, ablativeMax: 20 } });
    await applyDamageToVehicle(actor, { rawDamage: 5, side: "front", fromMine: true });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Аблативная Структура (против мин): +20");
    expect(card).toContain("остаток после попадания: 19");
  });
});
