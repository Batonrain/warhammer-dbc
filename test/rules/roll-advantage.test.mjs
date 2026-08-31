import { describe, it, expect } from "vitest";
import { pickHighest } from "../../module/rules/roll-advantage.mjs";

describe("pickHighest: бросок «с Преимуществом» — какой из N оставить", () => {
  it("«лучший» здесь — БОЛЬШИЙ (арифметика характеристики/инициативы, не d100-тест)", () => {
    expect(pickHighest([12, 73])).toEqual({ value: 73, index: 1, dropped: [12] });
  });

  it("три броска и больше тоже разбираются", () => {
    expect(pickHighest([55, 9, 88])).toMatchObject({ value: 88, index: 2 });
  });

  it("равные значения — оставляем первый, чтобы результат не плясал", () => {
    expect(pickHighest([40, 40])).toMatchObject({ value: 40, index: 0 });
  });

  it("один бросок — он же и результат, отброшенных нет", () => {
    expect(pickHighest([31])).toEqual({ value: 31, index: 0, dropped: [] });
  });

  it("пустой список — null, а не исключение посреди броска", () => {
    expect(pickHighest([])).toBeNull();
    expect(pickHighest(undefined)).toBeNull();
  });
});
