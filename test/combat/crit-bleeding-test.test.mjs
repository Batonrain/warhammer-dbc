// 3-edc4 п.18: кнопка теста «T+0, или получить Кровотечение» у трёх строк критических таблиц.
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CRITICAL_TABLES, getCriticalEffect } from "../../critical-tables.mjs";
import { parseBleedingTest, bleedingTestButtonHtml, shockDeathButtonHtml, parseCritEffectPills } from "../../module/combat/crit-effect-parser.mjs";
import { rollBleedingTest } from "../../module/combat/shock-death.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();

const allRows = () => {
  const rows = [];
  for (const [type, byLoc] of Object.entries(CRITICAL_TABLES))
    for (const [loc, entries] of Object.entries(byLoc))
      for (const [lvl] of entries) rows.push({ type, loc, lvl, text: getCriticalEffect(type, { head: "Голова", torso: "Торс", arm: "П. Рука", leg: "П. Нога" }[loc], lvl) });
  return rows;
};

describe("разбор строк «тест T+0, или получить Кровотечение»", () => {
  it("ровно три строки книги разбираются, остальные Кровотечения (безусловные и составные) — нет", () => {
    const parsed = allRows().filter(r => parseBleedingTest(r.text));
    expect(parsed.map(r => `${r.type}/${r.loc}/${r.lvl}`).sort()).toEqual(["blast/arm/4", "rending/arm/3", "rending/torso/3"].sort());
  });
  it("модификатор читается (T+0, T−10)", () => {
    expect(parseBleedingTest("должна пройти тест на T+0, или получить Кровотечение.")).toEqual({ char: "t", mod: 0 });
    expect(parseBleedingTest("должна пройти тест на Т−10, или получить Кровотечение")).toEqual({ char: "t", mod: -10 });
  });
  it("«или получить Кровотечение и …» (составное последствие) не ловится", () => {
    expect(parseBleedingTest("должна пройти тест на T+0, или получить 1d10 урона в T и Кровотечение")).toBeNull();
    expect(parseBleedingTest("Цель получает Кровотечение.")).toBeNull();
  });
  it("у этих трёх строк нет безусловной пилюли «Кровотечение» — только кнопка с тестом", () => {
    for (const r of allRows().filter(x => parseBleedingTest(x.text)))
      expect(parseCritEffectPills(r.text).map(p => p.key ?? p.condition ?? p.id), `${r.type}/${r.loc}/${r.lvl}`).not.toContain("bleeding");
    // составные строки по-прежнему дают пилюлю
    expect(parseCritEffectPills("Цель получает Кровотечение.").length).toBeGreaterThan(0);
  });
  it("кнопка рисуется общим shockDeathButtonHtml (три места вызова получают её сами)", () => {
    const text = "Цель роняет всё и должна пройти тест на T+0, или получить Кровотечение.";
    expect(shockDeathButtonHtml(text, "Actor.x")).toContain("wh-crit-bleed-test-btn");
    expect(bleedingTestButtonHtml(text, "")).toBe("");
    expect(shockDeathButtonHtml("Обычный текст", "Actor.x")).toBe("");
  });
});

describe("rollBleedingTest", () => {
  const actor = (items = []) => {
    const a = {
      name: "Цель", uuid: "Actor.x", items,
      system: { characteristics: { t: { total: 40 } }, conditions: {} },
      getFlag: () => undefined,
      update: async d => { for (const [p, v] of Object.entries(d)) { const parts = p.split("."); let c = a; for (const x of parts.slice(0, -1)) { c[x] ??= {}; c = c[x]; } c[parts.at(-1)] = v; } }
    };
    return a;
  };
  beforeEach(resetCaptured);
  afterEach(() => { captured.dice = null; clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });

  it("провал накладывает Кровотечение, успех — нет", async () => {
    const a = actor();
    captured.dice = [90];
    await rollBleedingTest(a, { mod: 0 });
    expect(a.system.conditions.bleeding).toBe(true);

    const b = actor();
    captured.dice = [10];
    await rollBleedingTest(b, { mod: 0 });
    expect(b.system.conditions.bleeding).toBeUndefined();
  });

  it("Крепкий Орешек: два броска, лучший спасает", async () => {
    const dieHard = { type: "talent", name: "Die Hard / Крепкий Орешек", system: {} };
    const a = actor([dieHard]);
    captured.dice = [90, 10];
    await rollBleedingTest(a, { mod: 0 });
    expect(a.system.conditions.bleeding).toBeUndefined();
  });
});
