import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { isVampiricDependencyItem, vampiricLastSatisfied, vampiricMonthsSince, vampiricTestRequired,
         vampiricTestPenalty, satisfyVampiricDependency, VAMPIRIC_TIME_FLAG } from "../../module/rules/vampiric-dependency.mjs";

const DAY = 86400;
const MONTH = 30 * DAY;

function fakeItem({ type = "mutation", name = "Vampiric Dependency / Вампирическая Зависимость", flag = undefined } = {}) {
  const store = {};
  if (flag !== undefined) store[VAMPIRIC_TIME_FLAG] = flag;
  return {
    type, name,
    getFlag: (ns, key) => store[key],
    setFlag: async (ns, key, value) => { store[key] = value; }
  };
}

describe("isVampiricDependencyItem", () => {
  it("совпадает по двуязычному имени", () => {
    expect(isVampiricDependencyItem(fakeItem())).toBe(true);
  });
  it("совпадает по английской половине", () => {
    expect(isVampiricDependencyItem(fakeItem({ name: "Vampiric Dependency" }))).toBe(true);
  });
  it("Addiction — другая мутация, false", () => {
    expect(isVampiricDependencyItem(fakeItem({ name: "Addiction / Зависимость" }))).toBe(false);
  });
  it("другой тип предмета — false", () => {
    expect(isVampiricDependencyItem(fakeItem({ type: "trait" }))).toBe(false);
  });
});

describe("vampiricLastSatisfied / vampiricMonthsSince", () => {
  it("флаг не стоял — null / 0 месяцев", () => {
    const item = fakeItem();
    expect(vampiricLastSatisfied(item)).toBeNull();
    expect(vampiricMonthsSince(item, 5 * MONTH)).toBe(0);
  });
  it("меньше месяца — 0", () => {
    const item = fakeItem({ flag: 0 });
    expect(vampiricMonthsSince(item, 20 * DAY)).toBe(0);
  });
  it("ровно месяц — 1", () => {
    const item = fakeItem({ flag: 0 });
    expect(vampiricMonthsSince(item, MONTH)).toBe(1);
  });
  it("2.9 месяца — округляет вниз до 2 (полных)", () => {
    const item = fakeItem({ flag: 0 });
    expect(vampiricMonthsSince(item, 2.9 * MONTH)).toBe(2);
  });
});

describe("vampiricTestRequired / vampiricTestPenalty", () => {
  it("меньше месяца — тест не нужен, штраф 0", () => {
    expect(vampiricTestRequired(0)).toBe(false);
    expect(vampiricTestPenalty(0)).toBe(0);
  });
  it("ровно 1 месяц — тест нужен, но без штрафа (первый просроченный месяц)", () => {
    expect(vampiricTestRequired(1)).toBe(true);
    expect(vampiricTestPenalty(1)).toBe(0);
  });
  it("3 месяца — −10 за каждый ПРЕДЫДУЩИЙ месяц (2 предыдущих)", () => {
    expect(vampiricTestPenalty(3)).toBe(-20);
  });
});

describe("satisfyVampiricDependency", () => {
  it("не эта Мутация — ничего не делает", async () => {
    const item = fakeItem({ name: "Addiction" });
    await satisfyVampiricDependency(item);
    expect(vampiricLastSatisfied(item)).toBeNull();
  });
  it("ставит флаг момента утоления", async () => {
    const item = fakeItem();
    await satisfyVampiricDependency(item);
    expect(vampiricLastSatisfied(item)).not.toBeNull();
  });
});
