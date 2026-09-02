import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { isAddictionItem, addictionLastSatisfied, addictionDaysSince, addictionPenalty, satisfyAddiction,
         ADDICTION_TIME_FLAG } from "../../module/rules/addiction.mjs";

const DAY = 86400;

function fakeItem({ type = "mutation", name = "Addiction / Зависимость", flag = undefined } = {}) {
  const store = {};
  if (flag !== undefined) store[ADDICTION_TIME_FLAG] = flag;
  return {
    type, name,
    getFlag: (ns, key) => store[key],
    setFlag: async (ns, key, value) => { store[key] = value; }
  };
}

describe("isAddictionItem", () => {
  it("совпадает по двуязычному имени, регистронезависимо", () => {
    expect(isAddictionItem(fakeItem({ name: "Addiction / Зависимость" }))).toBe(true);
    expect(isAddictionItem(fakeItem({ name: "addiction / зависимость" }))).toBe(true);
  });
  it("совпадает по одной английской половине", () => {
    expect(isAddictionItem(fakeItem({ name: "Addiction" }))).toBe(true);
  });
  it("другой тип предмета — false", () => {
    expect(isAddictionItem(fakeItem({ type: "trait" }))).toBe(false);
  });
  it("другое имя — false", () => {
    expect(isAddictionItem(fakeItem({ name: "Vampiric Dependency / Вампирическая Зависимость" }))).toBe(false);
  });
  it("нет предмета — false", () => {
    expect(isAddictionItem(null)).toBe(false);
  });
});

describe("addictionLastSatisfied / addictionDaysSince", () => {
  it("флаг не стоял — null / 0 суток (без штрафа задним числом)", () => {
    const item = fakeItem();
    expect(addictionLastSatisfied(item)).toBeNull();
    expect(addictionDaysSince(item, 100 * DAY)).toBe(0);
  });
  it("утолена только что — 0 суток", () => {
    const item = fakeItem({ flag: 10 * DAY });
    expect(addictionDaysSince(item, 10 * DAY)).toBe(0);
  });
  it("прошло 2.5 суток — считает дробную часть", () => {
    const item = fakeItem({ flag: 0 });
    expect(addictionDaysSince(item, 2.5 * DAY)).toBeCloseTo(2.5);
  });
});

describe("addictionPenalty", () => {
  it("нет Мутации на акторе — 0", () => {
    expect(addictionPenalty({ items: [] }, 100 * DAY)).toBe(0);
  });
  it("утолена меньше суток назад — 0", () => {
    const actor = { items: [fakeItem({ flag: 0 })] };
    expect(addictionPenalty(actor, 0.5 * DAY)).toBe(0);
  });
  it("ровно сутки без утоления — −10 (порог включительно)", () => {
    const actor = { items: [fakeItem({ flag: 0 })] };
    expect(addictionPenalty(actor, 1 * DAY)).toBe(-10);
  });
  it("несколько суток без утоления — всё ещё −10, не растёт", () => {
    const actor = { items: [fakeItem({ flag: 0 })] };
    expect(addictionPenalty(actor, 30 * DAY)).toBe(-10);
  });
  it("флаг ещё не стоял (мутация только что получена) — 0, не штраф задним числом", () => {
    const actor = { items: [fakeItem()] };
    expect(addictionPenalty(actor, 1000 * DAY)).toBe(0);
  });
});

describe("satisfyAddiction", () => {
  it("не Мутация «Зависимость» — ничего не делает", async () => {
    const item = fakeItem({ name: "Tentacle" });
    await satisfyAddiction(item);
    expect(addictionLastSatisfied(item)).toBeNull();
  });
  it("ставит флаг момента утоления", async () => {
    const item = fakeItem();
    await satisfyAddiction(item);
    expect(addictionLastSatisfied(item)).not.toBeNull();
  });
});
