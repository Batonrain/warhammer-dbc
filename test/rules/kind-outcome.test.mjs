// test/rules/kind-outcome.test.mjs
//
// resolveKindOutcome — вынесена из actor-sheet.mjs (_resolveKindOutcome) без
// изменений арифметики; test/sheets/skill-roll.test.mjs это уже подтверждает
// косвенно (через диалог), здесь — прямые проверки самой функции, потому что
// теперь её зовёт не только Навык/Характеристика.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
// kind-outcome.mjs строит подписи через helpers/utils.mjs::esc, а та зовёт
// foundry.utils.escapeHTML — заглушка нужна для загрузки, не для расчёта
// (см. шапку test/support/foundry-stub.mjs).
import "../support/foundry-stub.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const flags = {};
const actor = (over = {}) => ({
  system: { characteristics: {}, ...over },
  items: [],
  getFlag: (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]),
  setFlag: async (scope, key, value) => {
    flags[scope] ??= {};
    const parts = key.split(".");
    let node = flags[scope];
    for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
    node[parts.at(-1)] = value;
  }
});

beforeEach(() => { clearRuleSources(); for (const k in flags) delete flags[k]; });
afterEach(() => { clearRuleSources(); for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn); });

const ctx = a => ({ actor: a, kind: "skill", char: "wp" });

describe("resolveKindOutcome — base", () => {
  it("успех/степень как у testOutcome, без kindLabel", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 40, ctx: ctx(actor()) });
    expect(out).toMatchObject({ eff: 45, success: true, deg: 1, kindLabel: null });
  });

  it("autoSuccess засчитывает успех даже при формальном провале", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 20, rv: 80, ctx: ctx(actor()), autoSuccess: true });
    expect(out.success).toBe(true);
  });
});

describe("resolveKindOutcome — combined", () => {
  it("итоговый Порог — наименьший из двух, с подписью", async () => {
    const out = await resolveKindOutcome(actor(), {
      kind: "combined", baseEff: 45, rv: 25, ctx: ctx(actor()),
      combined: { charKey: "ag", target: 20 }
    });
    expect(out.eff).toBe(20);
    expect(out.success).toBe(false); // 25 > 20
    expect(out.combinedLine).toContain("итоговый Порог <b>20</b>");
  });
});

describe("resolveKindOutcome — extended", () => {
  it("успех копит банк на акторе, провал — нет", async () => {
    const a = actor();
    const s1 = await resolveKindOutcome(a, {
      kind: "extended", baseEff: 45, rv: 35, ctx: ctx(a), extended: { label: "Тест", goal: 10 }
    });
    expect(s1.extendedLine).toContain("Банк <b>2</b>/10");
    expect(a.getFlag("warhammer-dbc", "extendedTests.тест")).toEqual({ accumulated: 2, target: 10 });

    const s2 = await resolveKindOutcome(a, {
      kind: "extended", baseEff: 45, rv: 90, ctx: ctx(a), extended: { label: "Тест", goal: 10 }
    });
    expect(s2.extendedLine).toContain("+0");
    expect(a.getFlag("warhammer-dbc", "extendedTests.тест").accumulated).toBe(2);
  });

  it("достижение цели помечается ГОТОВО", async () => {
    const a = actor();
    await a.setFlag("warhammer-dbc", "extendedTests.тест", { accumulated: 9, target: 10 });
    const out = await resolveKindOutcome(a, {
      kind: "extended", baseEff: 45, rv: 10, ctx: ctx(a), extended: { label: "Тест", goal: 10 }
    });
    expect(out.extendedLine).toContain("ГОТОВО");
  });
});

describe("resolveKindOutcome — opposed", () => {
  it("побеждает атакующий с большей степенью", async () => {
    const out = await resolveKindOutcome(actor(), {
      kind: "opposed", baseEff: 45, rv: 20, ctx: ctx(actor()),
      opposed: { threshold: 40, roll: 35 }
    });
    expect(out.opposedLine).toMatch(/Вы побеждаете|Соперник побеждает/);
  });

  it("без данных соперника (opposed: null) — строки нет", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "opposed", baseEff: 45, rv: 20, ctx: ctx(actor()), opposed: null });
    expect(out.opposedLine).toBe("");
  });
});

describe("resolveKindOutcome — crit", () => {
  it("натуральный 1-5 — Критический Успех в строке", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 3, ctx: ctx(actor()) });
    expect(out.critLine).toContain("Критический Успех");
  });

  it("правило critRangeMod расширяет диапазон", async () => {
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "critRangeMod", target: "char:wp", side: "success", value: 10 }]
    }]);
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 10, ctx: ctx(actor()) });
    expect(out.critLine).toContain("Критический Успех");
  });
});
