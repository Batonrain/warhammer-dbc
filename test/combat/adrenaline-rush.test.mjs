// test/combat/adrenaline-rush.test.mjs
//
// module/combat/adrenaline-rush.mjs (wdbc-ks1r) — Adrenaline Rush/Прилив
// Адреналина: раз за бой/сцену + Очко Бесчестия, восстанавливает Реакции до
// максимума. «Дистанция отскока» не трекается движком — только чат-строка.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { hasAdrenalineRush, adrenalineRushAvailable, applyAdrenalineRush }
  from "../../module/combat/adrenaline-rush.mjs";

function trooper({ hasTalent = true, fate = 2, reactValue = 0, reactMax = 1, defenseValue = 0, defenseMax = 1 } = {}) {
  const flags = {};
  const data = {
    name: "Разведчик",
    items: hasTalent ? [{ type: "talent", name: "Adrenaline Rush / Прилив Адреналина" }] : [],
    system: {
      fate: { value: fate, max: 5 },
      reactions: { value: reactValue, max: reactMax, defenseValue, defenseMax }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  data.update = async patch => {
    if (patch["system.fate.value"] !== undefined) data.system.fate.value = patch["system.fate.value"];
    if (patch["system.reactions.value"] !== undefined) data.system.reactions.value = patch["system.reactions.value"];
    if (patch["system.reactions.defenseValue"] !== undefined) data.system.reactions.defenseValue = patch["system.reactions.defenseValue"];
  };
  return data;
}

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasAdrenalineRush", () => {
  it("определяет владение Талантом (kind:talent)", () => {
    expect(hasAdrenalineRush(trooper({ hasTalent: true }))).toBe(true);
    expect(hasAdrenalineRush(trooper({ hasTalent: false }))).toBe(false);
  });
});

describe("adrenalineRushAvailable / applyAdrenalineRush", () => {
  it("раз за сцену вне боя", async () => {
    const t = trooper();
    expect(adrenalineRushAvailable(t)).toBe(true);
    await applyAdrenalineRush(t);
    expect(adrenalineRushAvailable(t)).toBe(false);
  });

  it("тратит 1 Очко Бесчестия", async () => {
    const t = trooper({ fate: 2 });
    await applyAdrenalineRush(t);
    expect(t.system.fate.value).toBe(1);
  });

  it("без Очка Бесчестия — не активируется и лимит цел", async () => {
    const t = trooper({ fate: 0 });
    await applyAdrenalineRush(t);
    expect(adrenalineRushAvailable(t)).toBe(true);
  });

  it("восстанавливает Реакции (универсальные и Избегания) до максимума", async () => {
    const t = trooper({ reactValue: 0, reactMax: 2, defenseValue: 0, defenseMax: 1 });
    await applyAdrenalineRush(t);
    expect(t.system.reactions.value).toBe(2);
    expect(t.system.reactions.defenseValue).toBe(1);
  });

  it("чат-карточка упоминает дистанцию отскока как ручную", async () => {
    const t = trooper();
    await applyAdrenalineRush(t);
    expect(captured.chat[0].content).toContain("Дистанция отскока");
  });

  it("в бою — battle, раз использованное вне боя не блокирует бой (та же семантика unit, что Resplendent Raiment)", async () => {
    const t = trooper();
    globalThis.game.combat = { started: false };
    await applyAdrenalineRush(t);
    expect(adrenalineRushAvailable(t)).toBe(false);
    globalThis.game.combat = { started: true };
    expect(adrenalineRushAvailable(t)).toBe(true);
  });
});
