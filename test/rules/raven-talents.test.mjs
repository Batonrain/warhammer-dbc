// Ворон: Стойки Обмана, Ложный Клинок, Рычаг, Подножка, Пропустить (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  ravenStancesOf, maxRavenStances, doppelOutnumberWeight, superiorityDice,
  ravenContestOptions, ravenResistOptions, tripApplies, ravenEvasionNotes, skillWithChar
} from "../../module/rules/raven-talents.mjs";
import { MELEE_CONTESTS } from "../../module/constants/combat.mjs";
import { sideValue, sideLabel } from "../../module/combat/opposed-contest.mjs";

const it_ = (type, name) => ({ type, name });
const raven = (items = [], extra = {}) => ({
  items: [it_("trait", "Stances of Deceit / Стойки Обмана"), ...items],
  system: { characteristics: { ws: { total: 52 }, s: { total: 30 }, fel: { total: 40 } },
            skills: { deceive: { rank: "trained" }, athletics: { rank: "knows" } } },
  flags: { "warhammer-dbc": extra }
});

describe("Стойки Обмана", () => {
  it("одна Стойка, с Акупунктурой — две", () => {
    const a = raven([], { ravenStances: ["doppel", "superiority"] });
    expect(maxRavenStances(a)).toBe(1);
    expect(ravenStancesOf(a)).toEqual(["doppel"]);
    const b = raven([it_("talent", "Acupuncture / Акупунктура")], { ravenStances: ["doppel", "superiority"] });
    expect(ravenStancesOf(b)).toEqual(["doppel", "superiority"]);
  });
  it("Двойник: ⌊(WS.b+1)/3⌋, не меньше 1", () => {
    expect(doppelOutnumberWeight(raven([], { ravenStances: ["doppel"] }))).toBe(2);
    expect(doppelOutnumberWeight(raven([], { ravenStances: ["thief"] }))).toBe(1);
  });
  it("Превосходство: 2d10 только рукопашной по лежащему", () => {
    const a = raven([], { ravenStances: ["superiority"] });
    expect(superiorityDice(a, { isMelee: true, targetProne: true })).toBe("2d10");
    expect(superiorityDice(a, { isMelee: true, targetProne: false })).toBe("");
    expect(superiorityDice(a, { isMelee: false, targetProne: true })).toBe("");
  });
});

describe("Ложный Клинок и Рычаг", () => {
  it("Deceive(WS) = WS + Ранг Deceive", () => {
    expect(skillWithChar(raven(), "deceive", "ws")).toBe(62);
  });
  it("Финт: вариант Deceive(WS), сопротивление WS", () => {
    const a = raven([it_("trait", "False Blade / Ложный Клинок")]);
    const opts = ravenContestOptions(a, MELEE_CONTESTS.feint);
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({ skillKey: "deceive", charKey: "ws", value: 62, resist: [{ char: "ws" }] });
    expect(ravenContestOptions(a, MELEE_CONTESTS.knockdown)).toHaveLength(0);
  });
  it("Рычаг: в Повалить три варианта", () => {
    const a = raven([it_("talent", "Leverage / Рычаг")]);
    expect(ravenContestOptions(a, MELEE_CONTESTS.knockdown).map(o => o.label)).toHaveLength(3);
  });
  it("в защите — добавочные варианты", () => {
    const fb = raven([it_("trait", "False Blade / Ложный Клинок")]);
    expect(ravenResistOptions(fb, [{ skill: "", char: "ws" }])).toEqual([{ skill: "deceive", char: "ws", mod: 0 }]);
    const lev = raven([it_("talent", "Leverage / Рычаг")]);
    expect(ravenResistOptions(lev, [{ skill: "athletics", char: "" }])).toHaveLength(3);
    expect(ravenResistOptions(raven(), [{ skill: "", char: "ws" }])).toEqual([]);
  });
  it("сторона «Навык(Характеристика)» считается и подписывается", () => {
    const a = raven();
    expect(sideValue(a, { skill: "deceive", char: "ws" })).toBe(62);
    expect(sideLabel({ skill: "deceive", char: "ws" })).toBe("Deceive(WS)");
  });
});

describe("Подножка и Пропустить", () => {
  const trip = raven([it_("talent", "Trip / Подножка")]);
  it("перевес 5+ в WS против Размера до 1", () => {
    expect(tripApplies(trip, { side: { char: "ws" }, margin: 5, targetSize: 0 })).toBe(true);
    expect(tripApplies(trip, { side: { skill: "deceive", char: "ws" }, margin: 6, targetSize: 1 })).toBe(true);
    expect(tripApplies(trip, { side: { char: "ws" }, margin: 4, targetSize: 0 })).toBe(false);
    expect(tripApplies(trip, { side: { char: "ws" }, margin: 5, targetSize: 2 })).toBe(false);
    expect(tripApplies(trip, { side: { skill: "athletics" }, margin: 9, targetSize: 0 })).toBe(false);
    expect(tripApplies(raven(), { side: { char: "ws" }, margin: 9, targetSize: 0 })).toBe(false);
  });
  it("строка Пропустить — Избегание рукопашной на 5+", () => {
    const a = raven([it_("talent", "Pass By / Пропустить")]);
    expect(ravenEvasionNotes(a, { passed: true, deg: 5, isMelee: true })).toHaveLength(1);
    expect(ravenEvasionNotes(a, { passed: true, deg: 4, isMelee: true })).toHaveLength(0);
    expect(ravenEvasionNotes(a, { passed: true, deg: 6, isMelee: false })).toHaveLength(0);
  });
});
