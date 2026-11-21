// Монарх: ОД вассалов Короны Полентии, Пробуждение, Церебральный Поток,
// Извлечение Мозга, такт начала Хода (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  vassalApCost, vassalRegen, awakeningExtra, brainExtractOutcome, brainPrepProgress, VASSAL_ACTION_COST
} from "../../module/rules/monarch-talents.mjs";
import { processMonarchTurnStart, vassalPoolsOf } from "../../module/combat/monarch.mjs";

describe("ОД вассала", () => {
  it("цены 1/2/4, поддержание вдвое (окр.▼) только с Церебральным Потоком", () => {
    expect(VASSAL_ACTION_COST).toEqual({ free: 1, half: 2, full: 4 });
    expect(vassalApCost(2, { sustain: true, cerebral: true })).toBe(1);
    expect(vassalApCost(1, { sustain: true, cerebral: true })).toBe(0);
    expect(vassalApCost(2, { sustain: true })).toBe(2);
    expect(vassalApCost(4, { cerebral: true })).toBe(4);
  });
  it("+1 до 4; Пробуждение добирает до 4 восстановленных", () => {
    expect(vassalRegen(2)).toBe(1);
    expect(vassalRegen(4)).toBe(0);
    expect(awakeningExtra(1)).toBe(3);
    expect(awakeningExtra(3)).toBe(1);
  });
});

describe("Извлечение Мозга", () => {
  it("20 Успехов подготовки, 4+ Провала губят мозг", () => {
    expect(brainPrepProgress(18, { success: true, deg: 3 })).toEqual({ after: 21, done: true });
    expect(brainPrepProgress(5, { success: false, deg: 2 })).toEqual({ after: 5, done: false });
    expect(brainExtractOutcome({ success: true, deg: 1 })).toBe("extracted");
    expect(brainExtractOutcome({ success: false, deg: 3 })).toBe("retry");
    expect(brainExtractOutcome({ success: false, deg: 4 })).toBe("destroyed");
  });
});

describe("начало Хода Монарха", () => {
  const pool = (key, label) => ({
    type: "trait", name: label,
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "p", kind: "resourcePool", resPoolKey: key, resPoolLabel: label, resPoolMax: "4" }] }] } }
  });
  it("каждый пул вассала +1, полный не трогается", async () => {
    let upd = null;
    const a = {
      items: [pool("vassalAp", "ОД вассала"), pool("vassalApDragon", "ОД вассала (Дракон)")],
      system: { resourcePools: { vassalAp: 2, vassalApDragon: 4 } },
      update: async u => { upd = u; }
    };
    expect(vassalPoolsOf(a).map(p => p.key)).toEqual(["vassalAp", "vassalApDragon"]);
    await processMonarchTurnStart(a);
    expect(upd).toEqual({ "system.resourcePools.vassalAp": 3 });
  });
});
