// test/rules/flying-kick.test.mjs
//
// Flying Kick / Пинок с Полёта (Пугилист, стр. 62; Sahara 3-eddb, решение
// владельца 24.10.2026): «В Раунд, когда он совершает Натиск в полете, или
// дерется в воздухе с другим летающим персонажем, персонаж получает Трейт
// Multiple Arms (+2), отображающий использование им ударов ногами. Если
// персонаж имеет больше (или меньше), чем две ноги, бонус Трейта меняется.»
//
// Автоматизировано: высота low/high + База «Натиск» → +1 Атака в Ход за каждую
// добавленную пару ног (combat/attack-limit.mjs::attackActionLimit). В бюджет рук
// для экипировки (rules/hands.mjs::maxHands) ноги не входят.

import { describe, it, expect } from "vitest";
import { actorFor } from "../support/combat-fixtures.mjs";
import { flyingKickActive, flyingKickLegs, flyingKickHandsBonus, flyingKickAttackBonus }
  from "../../module/rules/pugilist-talents.mjs";
import { maxHands } from "../../module/rules/hands.mjs";
import { attackActionLimit } from "../../module/combat/attack-limit.mjs";

const FK = { id: "fk", name: "Flying Kick / Пинок с Полёта", type: "talent", system: {} };
const QUADRUPED = { id: "q", name: "Quadruped (2) / Четвероногий (2)", type: "trait", system: { rating: 2 } };

function flier({ altitude = "low", base = "charge", items = [FK] } = {}) {
  return actorFor({ items, meleeBase: base, movement: { altitude } });
}

describe("flyingKickActive: Талант + Натиск + высота low/high", () => {
  it("low и high + Натиск → активен", () => {
    expect(flyingKickActive(flier({ altitude: "low" }))).toBe(true);
    expect(flyingKickActive(flier({ altitude: "high" }))).toBe(true);
  });
  it("на земле — нет", () => {
    expect(flyingKickActive(flier({ altitude: "landed" }))).toBe(false);
    expect(flyingKickActive(flier({ altitude: "ground" }))).toBe(false);
  });
  it("не Натиск — нет", () => {
    expect(flyingKickActive(flier({ base: "standard" }))).toBe(false);
  });
  it("без Таланта — нет", () => {
    expect(flyingKickActive(flier({ items: [] }))).toBe(false);
  });
});

describe("число ног → бонус Трейта", () => {
  it("двуногий: 2 ноги → +2 руки", () => {
    expect(flyingKickLegs(flier())).toBe(2);
    expect(flyingKickHandsBonus(flier())).toBe(2);
  });
  it("четвероногий: 4 ноги → +4 руки", () => {
    const a = flier({ items: [FK, QUADRUPED] });
    expect(flyingKickLegs(a)).toBe(4);
    expect(flyingKickHandsBonus(a)).toBe(4);
  });
  it("неактивный — бонус 0", () => {
    expect(flyingKickHandsBonus(flier({ altitude: "landed" }))).toBe(0);
    expect(flyingKickAttackBonus(flier({ altitude: "landed" }))).toBe(0);
  });
});

describe("maxHands / attackActionLimit", () => {
  it("в полёте на Натиске бюджет рук для ЭКИПИРОВКИ не растёт: ноги — не ладони (ревью 3-eddb)", () => {
    expect(maxHands(flier({ altitude: "landed" }))).toBe(2);
    expect(maxHands(flier({ altitude: "low" }))).toBe(2);
    expect(maxHands(flier({ altitude: "high", items: [FK, QUADRUPED] }))).toBe(2);
  });
  it("каждая добавленная пара ног — +1 Атака в Ход: 1 → 2 (двуногий), 1 → 3 (четвероногий)", () => {
    expect(attackActionLimit(flier({ altitude: "landed" }))).toBe(1);
    expect(attackActionLimit(flier({ altitude: "low" }))).toBe(2);
    expect(attackActionLimit(flier({ altitude: "high", items: [FK, QUADRUPED] }))).toBe(3);
  });
  it("без Таланта в полёте ничего не меняется", () => {
    expect(maxHands(flier({ items: [] }))).toBe(2);
    expect(attackActionLimit(flier({ items: [] }))).toBe(1);
  });
});
