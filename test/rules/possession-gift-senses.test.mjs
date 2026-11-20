// Дары Одержимого «Варп-Зрение» и «Регенерация» действуют только в Проявлении (Разобрать 6plo6).
import { describe, it, expect } from "vitest";
import { hasWarpSightNow } from "../../module/rules/predicates.mjs";
import { hasAlternativeSenses } from "../../module/rules/blindness.mjs";
import { regenerationSource } from "../../module/rules/rubric-sorcerer.mjs";

const possessed = (gift, manifested, extra = {}) => ({
  type: "character",
  system: { possessed: true, possession: { manifested }, corruptionBonus: 5, ...extra },
  items: [{ type: "talent", name: gift }]
});

describe("Дар: Варп-Зрение", () => {
  it("в Проявлении — Варп-Зрение и альтернативные чувства", () => {
    const a = possessed("Warp Sight / Дар: Варп-Зрение", true);
    expect(hasWarpSightNow(a)).toBe(true);
    expect(hasAlternativeSenses(a)).toBe(true);
  });
  it("без Проявления — нет", () => {
    const a = possessed("Warp Sight / Дар: Варп-Зрение", false);
    expect(hasWarpSightNow(a)).toBe(false);
    expect(hasAlternativeSenses(a)).toBe(false);
  });
  it("Черта Warp Sight работает всегда", () => {
    expect(hasWarpSightNow({ items: [{ type: "trait", name: "Warp Sight / Варп-Зрение" }] })).toBe(true);
  });
});

describe("Дар: Регенерация", () => {
  it("в Проявлении — ½Cor.b (окр.▲), тест Cor+0", () => {
    expect(regenerationSource(possessed("Regeneration / Дар: Регенерация", true))).toEqual({ rating: 3, test: "cor" });
  });
  it("без Проявления — нечего", () => {
    expect(regenerationSource(possessed("Regeneration / Дар: Регенерация", false)).rating).toBe(0);
  });
  it("Черта больше Дара — тест T+0", () => {
    const a = possessed("Regeneration / Дар: Регенерация", true);
    a.items.push({ type: "trait", name: "Regeneration (5)" });
    expect(regenerationSource(a)).toEqual({ rating: 5, test: "t" });
  });
});

import { maxHands, multipleArmsAttackBonus } from "../../module/rules/hands.mjs";
describe("Дар: Братство", () => {
  it("в Проявлении — ещё пара рук и +1 Атака", () => {
    const a = possessed("Brotherhood / Дар: Братство", true);
    expect(maxHands(a)).toBe(4);
    expect(multipleArmsAttackBonus(a)).toBe(1);
  });
  it("без Проявления — обычные две руки", () => {
    const a = possessed("Brotherhood / Дар: Братство", false);
    expect(maxHands(a)).toBe(2);
    expect(multipleArmsAttackBonus(a)).toBe(0);
  });
});
