// Медуза: атаки Эмпата, Эмоциональный Взрыв, голод (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  empathAttackPreset, medusaAttackKind, medusaPr, explosionTestMod, explosionShockTotal, explosionApBonus,
  medusaHungry, hasAlienConsciousness, FEED_PERIOD
} from "../../module/rules/medusa-talents.mjs";

const EMPATH = { type: "trait", name: "Empath / Эмпат" };
const w = name => ({ type: "weapon", name });

describe("Эмпат", () => {
  it("атаки медузы — тестом W, +бPR у Глазной Вспышки и Волны", () => {
    const a = { items: [EMPATH], system: { psyker: { rating: 0 } } };
    expect(empathAttackPreset(a, w("Eyeburst / Глазная Вспышка"))).toEqual({ presetChar: "wp", presetDmgBonus: 3 });
    expect(empathAttackPreset(a, w("Coma / Кома"))).toEqual({ presetChar: "wp", presetDmgBonus: 0 });
    expect(empathAttackPreset(a, w("Wave of Empathy / Волна Эмпатии")).presetDmgBonus).toBe(3);
    expect(empathAttackPreset(a, w("Лазган"))).toEqual({});
    expect(empathAttackPreset({ items: [] }, w("Coma / Кома"))).toEqual({});
  });
  it("Эмпатия не путается с Волной Эмпатии", () => {
    expect(medusaAttackKind(w("Empathy / Эмпатия"))).toEqual({ pr: false });
    expect(medusaAttackKind(w("Material Wreck / Материальное Крушение"))).toEqual({ pr: true });
  });
  it("бPR медузы не меньше 3", () => {
    expect(medusaPr({ system: { psyker: { rating: 5 } } })).toBe(5);
    expect(medusaPr({})).toBe(3);
  });
});

describe("Эмоциональный Взрыв", () => {
  it("тест W−10−5×бPR, иммунитет к Страху — +30", () => {
    expect(explosionTestMod(3)).toBe(-25);
    expect(explosionTestMod(3, { fearImmune: true })).toBe(5);
  });
  it("Шок: +10 за каждый Провал сверх первого", () => {
    expect(explosionShockTotal(70, 1)).toBe(70);
    expect(explosionShockTotal(70, 4)).toBe(100);
  });
  it("ОД: +2, повторно в той же битве +1", () => {
    expect(explosionApBonus(null, "c1")).toBe(2);
    expect(explosionApBonus({ combatId: "c1", gained: true }, "c1")).toBe(1);
    expect(explosionApBonus({ combatId: "c0", gained: true }, "c1")).toBe(2);
  });
});

describe("Медуза и Чуждое Сознание", () => {
  it("голод — больше месяца без сильной эмоции", () => {
    expect(medusaHungry(0, FEED_PERIOD)).toBe(false);
    expect(medusaHungry(0, FEED_PERIOD + 1)).toBe(true);
    expect(medusaHungry(null, 1e12)).toBe(false);
  });
  it("Талант с запятой в имени опознаётся", () => {
    expect(hasAlienConsciousness({ items: [{ type: "talent", name: "Alien Consciousness, Alien Powers / Чуждое Сознание, Чуждые Силы" }] })).toBe(true);
    expect(hasAlienConsciousness(null)).toBe(false);
  });
});
