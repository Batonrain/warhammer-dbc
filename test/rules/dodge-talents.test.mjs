// test/rules/dodge-talents.test.mjs
//
// Таланты Избегания (глава 3): чистая логика rules/dodge-talents.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  DODGE_TALENTS, hasDodgeTalent, catfallHeight, catfallLeg,
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

// ── Второй проход ───────────────────────────────────────────────────────────
import {
  escapeArtistRelief, deflectableProjectile, isGrenadeProjectile, DEFLECT_BACK_DEGREES,
  flourishPenalty, bodyguardTokens
} from "../../module/rules/dodge-talents.mjs";

describe("Освобождение от Пут: escapeArtistRelief", () => {
  it("штраф −30 при A.b 4: возвращает 20 (A.b×5), переброса нет (30 ≥ A.b×3 = 12)", () => {
    expect(escapeArtistRelief([-20, -10, 5], 4)).toEqual({ penalty: 30, relief: 20, reroll: false });
  });
  it("мелкий штраф −5 возвращается целиком и разрешает переброс (5 < 12)", () => {
    expect(escapeArtistRelief([-5], 4)).toEqual({ penalty: 5, relief: 5, reroll: true });
  });
  it("плюсы штрафом не считаются; без штрафа — переброс допустим", () => {
    expect(escapeArtistRelief([20, 10], 4)).toEqual({ penalty: 0, relief: 0, reroll: true });
    expect(escapeArtistRelief(undefined, 4).penalty).toBe(0);
  });
  it("штраф ровно A.b×3 — переброса нет (нужно «ниже»)", () => {
    expect(escapeArtistRelief([-12], 4).reroll).toBe(false);
    expect(escapeArtistRelief([-11], 4).reroll).toBe(true);
  });
  it("A.b = 0 — ничего не возвращает", () => {
    expect(escapeArtistRelief([-10], 0)).toEqual({ penalty: 10, relief: 0, reroll: false });
  });
});

describe("Отбить Выстрел: deflectableProjectile", () => {
  it("метательное, луки/арбалеты, ракеты и пусковые — да", () => {
    expect(deflectableProjectile({ weaponClass: "thrown", weaponType: "grenade" })).toBe(true);
    expect(deflectableProjectile({ weaponClass: "basic", weaponType: "lowtech" })).toBe(true);
    expect(deflectableProjectile({ weaponClass: "pistol", weaponType: "lowtech" })).toBe(true);
    expect(deflectableProjectile({ weaponClass: "launcher", weaponType: "rocket" })).toBe(true);
    expect(deflectableProjectile({ weaponClass: "heavy", weaponType: "launcher" })).toBe(true);
  });
  it("лазеры, болтеры, плазма, рукопашное, пусто — нет", () => {
    for (const weaponType of ["laser", "bolt", "plasma", "solid"]) {
      expect(deflectableProjectile({ weaponClass: "basic", weaponType })).toBe(false);
    }
    expect(deflectableProjectile({ weaponClass: "melee", weaponType: "lowtech" })).toBe(false);
    expect(deflectableProjectile(undefined)).toBe(false);
  });
  it("граната: метательное класса grenade/explosive; нож — нет", () => {
    expect(isGrenadeProjectile({ weaponClass: "thrown", weaponType: "grenade" })).toBe(true);
    expect(isGrenadeProjectile({ weaponClass: "thrown", weaponType: "explosive" })).toBe(true);
    expect(isGrenadeProjectile({ weaponClass: "thrown", weaponType: "lowtech" })).toBe(false);
    expect(isGrenadeProjectile(null)).toBe(false);
    expect(DEFLECT_BACK_DEGREES).toBe(5);
  });
});

describe("Размашистый Танец: flourishPenalty", () => {
  it("−5 за каждый Успех, не выше нуля", () => {
    expect(flourishPenalty(3)).toBe(-15);
    expect(flourishPenalty(0)).toBe(0);
    expect(flourishPenalty(-2)).toBe(0);
    expect(flourishPenalty(undefined)).toBe(0);
  });
});

describe("Телохранитель: bodyguardTokens", () => {
  const base = { hasTalent: true, inContact: true, disposition: 1 };
  const ctx = { targetId: "T", attackerId: "A", targetDisposition: 1 };
  it("носитель в контакте на стороне цели — подходит", () => {
    expect(bodyguardTokens([{ id: "B", ...base }], ctx).map(t => t.id)).toEqual(["B"]);
  });
  it("сама цель, атакующий, чужая сторона, без Таланта, вне контакта — нет", () => {
    const tokens = [
      { id: "T", ...base }, { id: "A", ...base },
      { id: "E", ...base, disposition: -1 },
      { id: "N", ...base, hasTalent: false },
      { id: "F", ...base, inContact: false }
    ];
    expect(bodyguardTokens(tokens, ctx)).toEqual([]);
  });
  it("пустой список — пусто", () => {
    expect(bodyguardTokens(undefined, ctx)).toEqual([]);
  });
});
