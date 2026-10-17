// test/rules/dodge-talents.test.mjs
//
// Таланты Избегания (глава 3): чистая логика rules/dodge-talents.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  DODGE_TALENTS, hasDodgeTalent, catfallHeight, catfallLeg, CATFALL_TUCK_BONUS,
  speedAwarenessPenalty, talentBalance, grappleCoverHalfAngle
} from "../../module/rules/dodge-talents.mjs";

const actorWith = (...names) => ({
  items: names.map((name, i) => ({ id: `t${i}`, type: "talent", name, system: {}, getFlag: () => undefined })),
  getFlag: () => undefined
});

describe("hasDodgeTalent", () => {
  it("по имени Таланта (любая половина двуязычного имени)", () => {
    expect(hasDodgeTalent(actorWith("Catfall / Кошачье Приземление"), "catfall")).toBe(true);
    expect(hasDodgeTalent(actorWith("Combat Master / Мастер Боя"), "combatMaster")).toBe(true);
  });
  it("без Таланта и по неизвестному ключу — false", () => {
    expect(hasDodgeTalent(actorWith(), "catfall")).toBe(false);
    expect(hasDodgeTalent(actorWith("Catfall / Кошачье Приземление"), "bulwark")).toBe(false);
    expect(hasDodgeTalent(actorWith("Catfall / Кошачье Приземление"), "нет-такого")).toBe(false);
  });
  it("у каждого Таланта свой ключ dodge.core.*", () => {
    const keys = Object.values(DODGE_TALENTS).map(t => t.key);
    for (const k of keys) expect(k).toMatch(/^dodge\.core\./);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("Кошачье Приземление", () => {
  it("высота в расчёте урона уменьшается на A.b, не ниже нуля", () => {
    expect(catfallHeight(10, 3)).toBe(7);
    expect(catfallHeight(2, 3)).toBe(0);
    expect(catfallHeight(5, 0)).toBe(5);
  });
  it("бонус Группирования +20", () => expect(CATFALL_TUCK_BONUS).toBe(20));
  it("d2 → нога", () => {
    expect(catfallLeg(1)).toBe("Левая нога");
    expect(catfallLeg(2)).toBe("Правая нога");
  });
});

describe("Скоростная Внимательность: −5 за каждые полные P.b метров", () => {
  it("P.b 4: 20 м → −25, 19 м → −20, 3 м → 0", () => {
    expect(speedAwarenessPenalty(20, 4)).toBe(-25);
    expect(speedAwarenessPenalty(19, 4)).toBe(-20);
    expect(speedAwarenessPenalty(3, 4)).toBe(0);
  });
  it("нет P.b, отрицательная и пустая дистанция — штрафа нет", () => {
    expect(speedAwarenessPenalty(20, 0)).toBe(0);
    expect(speedAwarenessPenalty(-5, 4)).toBe(0);
    expect(speedAwarenessPenalty(undefined, 4)).toBe(0);
  });
});

describe("Оплот: Баланс щита для других Талантов", () => {
  it("щит с Оплотом — не ниже 1; без Оплота или не щит — как есть", () => {
    expect(talentBalance(-1, { bulwark: true, isShield: true })).toBe(1);
    expect(talentBalance(0, { bulwark: true, isShield: true })).toBe(1);
    expect(talentBalance(2, { bulwark: true, isShield: true })).toBe(2);
    expect(talentBalance(-1, { bulwark: false, isShield: true })).toBe(-1);
    expect(talentBalance(-1, { bulwark: true, isShield: false })).toBe(-1);
  });
});

describe("Живой Щит: сектор укрытия Борьбы", () => {
  it("±45° по общему правилу, ±90° (арка 180°) с Талантом", () => {
    expect(grappleCoverHalfAngle(false)).toBe(45);
    expect(grappleCoverHalfAngle(true)).toBe(90);
  });
});
