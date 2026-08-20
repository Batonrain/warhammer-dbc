// test/apps/minions.test.mjs
//
// Связь «слуга — Хозяин», которой пользуется Конструктор Механики: кто чей
// миньон, от какой Характеристики Хозяина идёт Лояльность и как она меняется.
//
// Всё, что было про панели на «Записях», ушло вместе с ними: слуга теперь
// отдельный тип актора, а перечень слуг Хозяина — блок «МИНЬОНЫ» на вкладке
// СОЦИУМ (test/sheets/minions-panel.test.mjs).

import { describe, it, expect } from "vitest";
import {
  MINION_TYPES, minionsOf, baseLoyaltyFor, loyaltyAfterChange
} from "../../module/apps/minions.mjs";

/** Подставные акторы: обычные литералы, никакого Foundry. */
const master = (over = {}) => ({
  id: "m1", uuid: "Actor.m1", name: "Хозяин", type: "character",
  system: { characteristics: { fel: { total: 42 }, per: { total: 31 }, int: { total: 25 }, wp: { total: 38 } } },
  ...over
});

const minion = ({ id = "s1", name = "Слуга", masterUuid = "Actor.m1", minionType = "human",
                  minionTier = "lesser", value = 0, max = 0, type = "character" } = {}) => ({
  id, uuid: `Actor.${id}`, name, type,
  system: { masterUuid, minionType, minionTier, loyalty: { value, max }, characteristics: {} }
});

describe("minionsOf", () => {
  it("находит акторов, чей Хозяин — этот", () => {
    const m = master();
    const mine = minion({ id: "a" });
    const other = minion({ id: "b", masterUuid: "Actor.zzz" });
    expect(minionsOf(m, [mine, other, m]).map(a => a.id)).toEqual(["a"]);
  });

  it("без uuid и без акторов — пусто", () => {
    expect(minionsOf(null, [minion()])).toEqual([]);
    expect(minionsOf(master(), [])).toEqual([]);
  });
});

describe("baseLoyaltyFor", () => {
  it("берёт ЗНАЧЕНИЕ своей характеристики Хозяина для каждой группы", () => {
    const m = master();
    expect(baseLoyaltyFor(m, "human")).toBe(42);   // F
    expect(baseLoyaltyFor(m, "beast")).toBe(31);   // P
    expect(baseLoyaltyFor(m, "machine")).toBe(25); // I
    expect(baseLoyaltyFor(m, "daemon")).toBe(38);  // W
  });

  it("без типа и без Хозяина — ноль", () => {
    expect(baseLoyaltyFor(master(), "")).toBe(0);
    expect(baseLoyaltyFor(master(), "unknown")).toBe(0);
    expect(baseLoyaltyFor(null, "human")).toBe(0);
  });

  it("у каждой группы книги есть своя характеристика Хозяина", () => {
    expect(Object.values(MINION_TYPES).every(d => !!d.masterChar)).toBe(true);
  });
});

describe("loyaltyAfterChange", () => {
  it("прибавляет и вычитает", () => {
    expect(loyaltyAfterChange(minion({ value: 10, max: 40 }), 5)).toBe(15);
    expect(loyaltyAfterChange(minion({ value: 10, max: 40 }), -4)).toBe(6);
  });

  it("ниже нуля не опускается", () => {
    expect(loyaltyAfterChange(minion({ value: 2, max: 40 }), -10)).toBe(0);
  });

  it("выше максимума не поднимается", () => {
    expect(loyaltyAfterChange(minion({ value: 38, max: 40 }), 10)).toBe(40);
  });

  // Нулевой максимум означает «Лояльность ещё не считали», а не потолок в ноль:
  // иначе прибавка миньону без синхронизации молча пропадала бы.
  it("нулевой максимум потолком не считается", () => {
    expect(loyaltyAfterChange(minion({ value: 0, max: 0 }), 7)).toBe(7);
  });
});
