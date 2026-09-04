// test/combat/imperative-bonuses.test.mjs
//
// module/combat/imperative-bonuses.mjs (wdbc-yu32) — читает активный
// Императив цели (module/rules/imperative.mjs) для теста Избегания и для
// клапана AP укрытия «не более чем вдвое/×2» (module/combat/recoil.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { evasionImperativeBonus, coverApImperativeAdjust, hasEvasionRecoilImperative } from "../../module/combat/imperative-bonuses.mjs";

const actorWithCarrier = bonuses => ({
  items: [{ getFlag: (scope, key) => (key === "imperativeCarrier" ? true : key === "imperativeBonuses" ? bonuses : undefined) }]
});
const actorWithoutCarrier = () => ({ items: [] });

describe("evasionImperativeBonus", () => {
  it("нет активного Императива — 0", () => {
    expect(evasionImperativeBonus(actorWithoutCarrier())).toBe(0);
  });
  it("возвращает evasionBonus активного носителя", () => {
    expect(evasionImperativeBonus(actorWithCarrier({ evasionBonus: 30 }))).toBe(30);
    expect(evasionImperativeBonus(actorWithCarrier({ evasionBonus: -30 }))).toBe(-30);
  });

  // wdbc-hdxj: Evasion/Fortress Imperative переворачивают знак СПЕЦИАЛЬНО для
  // Отскока в укрытие («+30 на Избегания, КРОМЕ Отскока в укрытие −20», и
  // наоборот у Fortress) — planningRecoil=true декларирует это заранее.
  it("planningRecoil=true с evasionRecoilBonus — берёт recoil-специфичный знак вместо обычного", () => {
    const evasion = actorWithCarrier({ evasionBonus: 30, evasionRecoilBonus: -20 });
    expect(evasionImperativeBonus(evasion, { planningRecoil: true })).toBe(-20);
    const fortress = actorWithCarrier({ evasionBonus: -30, evasionRecoilBonus: 20 });
    expect(evasionImperativeBonus(fortress, { planningRecoil: true })).toBe(20);
  });

  it("planningRecoil=false (умолчание) игнорирует evasionRecoilBonus — обычное значение, как раньше", () => {
    const evasion = actorWithCarrier({ evasionBonus: 30, evasionRecoilBonus: -20 });
    expect(evasionImperativeBonus(evasion)).toBe(30);
    expect(evasionImperativeBonus(evasion, { planningRecoil: false })).toBe(30);
  });

  it("planningRecoil=true без evasionRecoilBonus (прочие Императивы/эффекты) — обычное значение", () => {
    const other = actorWithCarrier({ evasionBonus: 10 });
    expect(evasionImperativeBonus(other, { planningRecoil: true })).toBe(10);
  });
});

describe("hasEvasionRecoilImperative", () => {
  it("нет активного Императива — false", () => {
    expect(hasEvasionRecoilImperative(actorWithoutCarrier())).toBe(false);
  });
  it("активный Императив без evasionRecoilBonus — false (чекбокс декларации не показывается)", () => {
    expect(hasEvasionRecoilImperative(actorWithCarrier({ evasionBonus: 10 }))).toBe(false);
  });
  it("активный Evasion/Fortress Imperative с evasionRecoilBonus — true", () => {
    expect(hasEvasionRecoilImperative(actorWithCarrier({ evasionBonus: 30, evasionRecoilBonus: -20 }))).toBe(true);
    expect(hasEvasionRecoilImperative(actorWithCarrier({ evasionBonus: -30, evasionRecoilBonus: 20 }))).toBe(true);
  });
});

describe("coverApImperativeAdjust", () => {
  it("нет активного Императива — AP не меняется", () => {
    expect(coverApImperativeAdjust(actorWithoutCarrier(), 6)).toBe(6);
  });

  it("Императив Избегания: −8, но не ниже половины базового AP", () => {
    const actor = actorWithCarrier({ coverApDelta: -8, coverApFloorRatio: 0.5 });
    expect(coverApImperativeAdjust(actor, 10)).toBe(5);   // 10-8=2, floor 10×0.5=5 → clamp 5
    expect(coverApImperativeAdjust(actor, 4)).toBe(2);    // 4-8=-4, floor 4×0.5=2 → clamp 2
  });

  it("Императив Крепости: +8, но не выше удвоенного базового AP", () => {
    const actor = actorWithCarrier({ coverApDelta: 8, coverApCeilRatio: 2 });
    expect(coverApImperativeAdjust(actor, 4)).toBe(8);    // 4+8=12, ceil 8 → clamp 8
    expect(coverApImperativeAdjust(actor, 10)).toBe(18);  // 10+8=18, ceil 20 → не клампится
  });

  it("базовый AP 0 — увеличение тоже клампится нулём (нечего усиливать)", () => {
    const actor = actorWithCarrier({ coverApDelta: 8, coverApCeilRatio: 2 });
    expect(coverApImperativeAdjust(actor, 0)).toBe(0);
  });
});
