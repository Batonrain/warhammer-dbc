// test/combat/eternal-warrior.test.mjs
//
// module/combat/eternal-warrior.mjs (wdbc-sk8s) — Eternal Warrior/Вечный Воин:
// умирая в Ярости, раз за сессию бесплатное Спасение/Защита; доступность и
// троттлинг сессии. Сама стоимость Спасения/Защиты (пути free/flat) —
// test/sheets/tabs/death.test.mjs, там же foundry-stub с Roll/ChatMessage.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import {
  hasEternalWarrior, eternalWarriorEligible, eternalWarriorFreeSaveAvailable, markEternalWarriorUsed
} from "../../module/combat/eternal-warrior.mjs";

function berserker({ hasGift = true, inRage = true } = {}) {
  const flags = {};
  return {
    name: "Берсерк",
    items: hasGift ? [{ type: "mutation", name: "Eternal Warrior / Вечный Воин" }] : [],
    system: { inRage },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

afterEach(resetCaptured);

describe("hasEternalWarrior", () => {
  it("определяет владение Даром (kind:mutation)", () => {
    expect(hasEternalWarrior(berserker({ hasGift: true }))).toBe(true);
    expect(hasEternalWarrior(berserker({ hasGift: false }))).toBe(false);
  });
});

describe("eternalWarriorEligible", () => {
  it("требует и Дар, и Ярость", () => {
    expect(eternalWarriorEligible(berserker({ hasGift: true, inRage: true }))).toBe(true);
    expect(eternalWarriorEligible(berserker({ hasGift: true, inRage: false }))).toBe(false);
    expect(eternalWarriorEligible(berserker({ hasGift: false, inRage: true }))).toBe(false);
  });
});

describe("eternalWarriorFreeSaveAvailable / markEternalWarriorUsed", () => {
  it("доступен один раз за сессию", async () => {
    const actor = berserker();
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(true);
    await markEternalWarriorUsed(actor);
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(false);
  });

  it("вне Ярости недоступен, даже если заряд сессии свободен", () => {
    const actor = berserker({ inRage: false });
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(false);
  });
});
