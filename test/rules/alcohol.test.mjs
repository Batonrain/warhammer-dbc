// 3-edc4 п.8: счётчик Провалов Алкоголя (rules/alcohol.mjs + combat/alcohol.mjs), Декаданс ×2.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  isAlcoholName, alcoholDecayed, alcoholDrinkPenalty, alcoholFailsOf, alcoholThresholds, alcoholEffects, ALCOHOL_DECAY_SECONDS
} from "../../module/rules/alcohol.mjs";
import { applyAlcoholDrink, isAlcoholItem } from "../../module/combat/alcohol.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();

describe("rules/alcohol", () => {
  it("опознаёт именно Алкоголь, не любой препарат", () => {
    expect(isAlcoholName("Alcohol / Алкоголь")).toBe(true);
    expect(isAlcoholName("Алкоголь")).toBe(true);
    expect(isAlcoholName("Lho / Лхо")).toBe(false);
    expect(isAlcoholItem({ type: "drug", name: "Alcohol / Алкоголь" })).toBe(true);
    expect(isAlcoholItem({ type: "gear", name: "Alcohol / Алкоголь" })).toBe(false);
  });
  it("штраф −10 за каждую рюмку после первой", () => {
    expect([0, 1, 2, 3].map(alcoholDrinkPenalty)).toEqual([0, -10, -20, -30]);
  });
  it("Провалы — степени провала; успех даёт 0 (Успехи не вычитаются)", () => {
    expect(alcoholFailsOf(30, 40)).toBe(0);
    expect(alcoholFailsOf(41, 40)).toBe(1);
    expect(alcoholFailsOf(60, 40)).toBe(3);
  });
  it("спад: −1 Провал за каждые 20 минут, остаток минут не теряется; трезвый — рюмки обнулены", () => {
    const s = { fails: 5, drinks: 4, at: 0 };
    expect(alcoholDecayed(s, ALCOHOL_DECAY_SECONDS * 2 + 100)).toEqual({ fails: 3, drinks: 4, at: ALCOHOL_DECAY_SECONDS * 2 });
    expect(alcoholDecayed(s, ALCOHOL_DECAY_SECONDS * 9)).toEqual({ fails: 0, drinks: 0, at: ALCOHOL_DECAY_SECONDS * 9 });
  });
  it("трезвый после 20 минут без рюмки — попойка кончилась, штраф с нуля", () => {
    expect(alcoholDecayed({ fails: 0, drinks: 2, at: 0 }, ALCOHOL_DECAY_SECONDS - 1)).toEqual({ fails: 0, drinks: 2, at: 0 });
    expect(alcoholDecayed({ fails: 0, drinks: 2, at: 0 }, ALCOHOL_DECAY_SECONDS)).toEqual({ fails: 0, drinks: 0, at: ALCOHOL_DECAY_SECONDS });
  });

  it("ступени: 5+ без Ментальных, 7+ −10 и иммунитет, 9+ −20 без Бега, 15 — сознание; Декаданс ×2", () => {
    expect(alcoholEffects(4).noMental).toBe(false);
    expect(alcoholEffects(5)).toMatchObject({ noMental: true, fearBonus: 40 });
    expect(alcoholEffects(7)).toMatchObject({ physicalPenalty: -10, fearImmune: true });
    expect(alcoholEffects(9)).toMatchObject({ physicalPenalty: -20, noRunCharge: true });
    expect(alcoholEffects(15).unconscious).toBe(true);
    expect(alcoholThresholds(true)).toEqual({ mental: 10, physical: 14, noRun: 18, unconscious: 30 });
    expect(alcoholEffects(15, true).unconscious).toBe(false);
    expect(alcoholEffects(9, true).noMental).toBe(false);
    expect(alcoholEffects(30, true).unconscious).toBe(true);
  });
});

function drinker({ t = 40, items = [] } = {}) {
  const flags = {};
  const a = {
    id: "d", name: "Пьяница", items,
    system: { characteristics: { t: { total: t, bonus: Math.floor(t / 10) } }, conditions: {} },
    getFlag: (ns, k) => flags[`${ns}.${k}`], setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    update: async d => { for (const [p, v] of Object.entries(d)) { const parts = p.split("."); let c = a; for (const x of parts.slice(0, -1)) { c[x] ??= {}; c = c[x]; } c[parts.at(-1)] = v; } }
  };
  return a;
}
const decadence = () => ({ type: "talent", name: "Decadence / Декаданс", system: {} });
const item = { type: "drug", name: "Alcohol / Алкоголь" };

describe("applyAlcoholDrink", () => {
  beforeEach(() => { resetCaptured(); game.time = { worldTime: 0 }; });
  afterEach(() => { captured.dice = null; clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });

  it("первая рюмка без штрафа, вторая −10; Провалы копятся, Успехи нет", async () => {
    const a = drinker({ t: 40 });
    captured.dice = [60, 40]; // 60 vs 40 → 3 Провала; вторая: порог 30, бросок 40 → 2 Провала
    await applyAlcoholDrink(a, item);
    expect(a.getFlag("warhammer-dbc", "alcohol")).toMatchObject({ fails: 3, drinks: 1 });
    await applyAlcoholDrink(a, item);
    expect(a.getFlag("warhammer-dbc", "alcohol")).toMatchObject({ fails: 5, drinks: 2 });
    expect(captured.chat.at(-1).content).toContain("не может проводить Ментальные действия");
  });

  it("успех не уменьшает счётчик", async () => {
    const a = drinker({ t: 40 });
    captured.dice = [60, 10];
    await applyAlcoholDrink(a, item);
    await applyAlcoholDrink(a, item);
    expect(a.getFlag("warhammer-dbc", "alcohol").fails).toBe(3);
  });

  it("успех, успех — третья рюмка всё равно −20: рюмки копятся и у непровалившего", async () => {
    const a = drinker({ t: 40 });
    captured.dice = [10, 10, 99];
    await applyAlcoholDrink(a, item); await applyAlcoholDrink(a, item); await applyAlcoholDrink(a, item);
    expect(captured.chat.at(-1).content).toContain("-20 (рюмка №3)");
    expect(a.getFlag("warhammer-dbc", "alcohol")).toMatchObject({ fails: 8, drinks: 3 }); // 99 против 20
  });

  it("между рюмками прошло 40 минут — два Провала сошли", async () => {
    const a = drinker({ t: 40 });
    captured.dice = [60, 10];
    await applyAlcoholDrink(a, item);
    game.time = { worldTime: 2400 };
    await applyAlcoholDrink(a, item);
    expect(a.getFlag("warhammer-dbc", "alcohol").fails).toBe(1);
  });

  it("15 Провалов — потеря сознания; с Декадансом тот же счёт ещё не сознание", async () => {
    const a = drinker({ t: 10 });
    captured.nextRoll = 99; // порог 10 → 9 Провалов; вторая рюмка (порог 0) → ещё 10
    await applyAlcoholDrink(a, item); await applyAlcoholDrink(a, item);
    expect(a.getFlag("warhammer-dbc", "alcohol").fails).toBeGreaterThanOrEqual(15);
    expect(a.system.conditions.unconscious).toBe(true);

    resetCaptured();
    const b = drinker({ t: 10, items: [decadence()] });
    captured.nextRoll = 99;
    await applyAlcoholDrink(b, item); await applyAlcoholDrink(b, item);
    expect(b.getFlag("warhammer-dbc", "alcohol").fails).toBeGreaterThanOrEqual(15);
    expect(b.system.conditions.unconscious).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("Декаданс");
  });
});
