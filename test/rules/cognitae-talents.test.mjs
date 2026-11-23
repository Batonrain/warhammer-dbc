// Когнитэ: Гипно-Программирование, Ритуал Восьми Спиц (21.11.2026).
import { describe, it, expect } from "vitest";
import {
  WEEK, hypnoAdvance, eightSpokesPenalty, hypnoVictimMod, hypnoPersonalityNeed, hypnoProgress, timedFlagActive
} from "../../module/rules/cognitae-talents.mjs";

const trait = (name, flags = {}) => ({ name, type: "trait", flags: { "warhammer-dbc": flags } });

describe("Когнитэ", () => {
  it("ступень Гипно-Программирования — метка на Черте, 0..30", () => {
    expect(hypnoAdvance({ items: [trait("Hypno-Programming / Гипно-Программирование", { hypnoAdvance: 20 })] })).toBe(20);
    expect(hypnoAdvance({ items: [trait("Hypno-Programming / Гипно-Программирование", { hypnoAdvance: 70 })] })).toBe(30);
    expect(hypnoAdvance({ items: [] })).toBe(0);
  });
  it("Ритуал Восьми Спиц: −10 за каждую начатую неделю опоздания", () => {
    const a = d => ({ items: [trait("Ritual of Eight Spokes / Ритуал Восьми Спиц")], flags: { "warhammer-dbc": { eightSpokes: { deadline: d } } } });
    expect(eightSpokesPenalty(a(100), 50)).toBe(0);
    expect(eightSpokesPenalty(a(100), 101)).toBe(-10);
    expect(eightSpokesPenalty(a(100), 100 + WEEK + 1)).toBe(-20);
    expect(eightSpokesPenalty({ items: [] }, 1e9)).toBe(0);
  });
  it("Каталептический Узел — −30; смена личности — 10×W.b; копилка по Когнитэ", () => {
    expect(hypnoVictimMod({ items: [{ name: "6. Каталептический Узел / Catalepsean Node", type: "implant" }] })).toBe(-30);
    expect(hypnoVictimMod({ items: [] })).toBe(0);
    expect(hypnoPersonalityNeed({ system: { characteristics: { wp: { bonus: 4 } } } })).toBe(40);
    const v = { flags: { "warhammer-dbc": { hypnoProgress: { by: "A", total: 7 } } } };
    expect(hypnoProgress(v, "A")).toBe(7);
    expect(hypnoProgress(v, "B")).toBe(0);
  });
  it("метки со сроком", () => {
    const a = { flags: { "warhammer-dbc": { perfectMask: { until: 10 } } } };
    expect(timedFlagActive(a, "perfectMask", 5)).toBe(true);
    expect(timedFlagActive(a, "perfectMask", 10)).toBe(false);
  });
});

// Sahara 581-7bb9: Вуаль Лжи — прокси-личность: Deceive(I)+0 против Успехов атакующего.
import { hasVeilOfLies, veilProxyAccepted } from "../../module/rules/cognitae-talents.mjs";
import { cultTestBase } from "../../module/rules/cult-tests.mjs";

describe("Вуаль Лжи: прокси-личность", () => {
  it("Черта узнаётся по имени", () => {
    expect(hasVeilOfLies({ items: [trait("Veil of Lies / Вуаль Лжи")] })).toBe(true);
    expect(hasVeilOfLies({ items: [] })).toBe(false);
  });
  it("принята, если тест Deceive успешен и Успехов не меньше, чем у атакующего", () => {
    expect(veilProxyAccepted({ success: true, deg: 2 }, 2)).toBe(true);
    expect(veilProxyAccepted({ success: true, deg: 3 }, 2)).toBe(true);
    expect(veilProxyAccepted({ success: true, deg: 1 }, 2)).toBe(false);
    expect(veilProxyAccepted({ success: false, deg: 3 }, 0)).toBe(false);
    expect(veilProxyAccepted({ success: true, deg: 1 }, 0)).toBe(true);
  });
  it("Deceive(I): база навыка с Интеллектом вместо Общительности", () => {
    const actor = { system: { characteristics: { fel: { total: 30 }, int: { total: 45 } }, skills: { deceive: { total: 40 } } } };
    expect(cultTestBase(actor, { skill: "deceive", charOverride: "int" })).toMatchObject({ base: 55, char: "int", skill: "deceive" });
    expect(cultTestBase(actor, { skill: "deceive" }).base).toBe(40);
    const untrained = { system: { characteristics: { fel: { total: 30 }, int: { total: 45 } }, skills: {} } };
    expect(cultTestBase(untrained, { skill: "deceive", charOverride: "int" }).base).toBe(25);
  });
});
