// 3-dc87: Талант «Крючок» (Hook Up, Медик). Книга: −30 на тест крафта наркотика
// → минимальное опасное число применений в неделю вдвое меньше (окр.▼),
// принимающие перебрасывают тест Зависимости.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hookUpMinDose, isHookedUp, hookUpAvailable, hookUpCraftMod, HOOK_UP_CRAFT_PENALTY
} from "../../module/rules/drug-doses.mjs";
import { weeklyDoseCheck } from "../../module/sheets/tabs/drugs.mjs";
import { computeCombined } from "../../module/constants/craft.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const NOW = 10_000_000;
const grant = key => registerRuleSource("test", () => [{ id: "t." + key, when: {}, effects: [{ kind: "grantFlag", target: key }] }]);

describe("чистая арифметика", () => {
  it("лимит вдвое, окр.▼, но не ниже 1; 0 остаётся 0", () => {
    expect([1, 2, 3, 4, 5].map(hookUpMinDose)).toEqual([1, 1, 1, 2, 2]);
    expect(hookUpMinDose(0)).toBe(0);
  });
  it("метка на предмете читается с getFlag и с сырых flags", () => {
    expect(isHookedUp({ getFlag: () => true })).toBe(true);
    expect(isHookedUp({ flags: { "warhammer-dbc": { hookUp: true } } })).toBe(true);
    expect(isHookedUp({ getFlag: () => undefined })).toBe(false);
  });
});

describe("крафт: −30 только у владельца Таланта, в режиме Крафт, категории «Химия»", () => {
  afterEach(() => { clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });
  const crafter = { items: [], system: {} };
  const proj = { mode: "craft", categoryKey: "chem", hookUp: true };

  it("без Таланта — недоступно", () => {
    clearRuleSources();
    expect(hookUpAvailable(crafter, proj)).toBe(false);
    expect(hookUpCraftMod(crafter, proj)).toBe(0);
  });
  it("с Талантом — −30; галочка снята или другая категория — 0", () => {
    clearRuleSources(); grant("medic.core.hookUp");
    expect(hookUpCraftMod(crafter, proj)).toBe(HOOK_UP_CRAFT_PENALTY);
    expect(hookUpCraftMod(crafter, { ...proj, hookUp: false })).toBe(0);
    expect(hookUpCraftMod(crafter, { ...proj, categoryKey: "armor" })).toBe(0);
    expect(hookUpCraftMod(crafter, { ...proj, mode: "research" })).toBe(0);
  });
  it("−30 попадает в Предел комбинированного теста", () => {
    const opt = { total: 60, value: "skill:x", isTrade: true, isLore: false };
    const plain = computeCombined([opt], { toolMod: 0, gmMod: 0, improveMod: 0, hookUpMod: 0 }).limit;
    const hooked = computeCombined([opt], { toolMod: 0, gmMod: 0, improveMod: 0, hookUpMod: -30 }).limit;
    expect(plain - hooked).toBe(30);
  });
});

describe("недельный счётчик: препарат с «Крючком»", () => {
  const flags = {};
  const actor = () => ({
    name: "Ходок", items: [], system: { characteristics: { t: { total: 40, bonus: 4 } } },
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; }, update: async () => {}
  });
  const drug = (hooked) => ({
    name: "Шквал", type: "drug", update: async () => {},
    getFlag: () => hooked,
    system: { addiction: { hasAddiction: true, isAddicted: false, minDose: 4, testChar: "t", testMod: 30 } }
  });
  beforeEach(() => {
    resetCaptured();
    for (const k of Object.keys(flags)) delete flags[k];
    globalThis.game.time = { worldTime: NOW };
    captured.dice = [50];
    clearRuleSources();
  });
  afterEach(() => { clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });

  it("без «Крючка» тест на 4-й дозе; с «Крючком» (лимит 2) — уже на 2-й", async () => {
    const a = actor(); const plain = drug(false);
    for (let i = 0; i < 3; i++) await weeklyDoseCheck(a, plain);
    expect(captured.chat).toHaveLength(0);

    for (const k of Object.keys(flags)) delete flags[k];
    resetCaptured(); captured.dice = [50, 50];
    const b = actor(); const hooked = drug(true);
    await weeklyDoseCheck(b, hooked);
    expect(captured.chat).toHaveLength(0);
    await weeklyDoseCheck(b, hooked);
    expect(captured.chat.at(-1).content).toContain("Тест Зависимости");
  });

  it("успешный тест Зависимости препарата с «Крючком» перебрасывается (бросок 50 ≤ 70 → второй бросок 95 — провал)", async () => {
    const a = actor(); const hooked = drug(true);
    captured.dice = [50, 95];
    await weeklyDoseCheck(a, hooked);
    await weeklyDoseCheck(a, hooked);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Крючок: успех (50) обязательно перебрасывается");
    expect(html).toContain("стал зависим");
  });
});
