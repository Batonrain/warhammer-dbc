import { describe, it, expect } from "vitest";
import { pickReroll } from "../../module/rules/reroll-pick.mjs";

describe("pickReroll: какой из бросков оставить", () => {
  it("«лучший» на d100 — это МЕНЬШИЙ: тест проходится броском не выше порога", () => {
    expect(pickReroll([73, 12], "keepBest")).toEqual({ value: 12, index: 1, dropped: [73] });
  });

  it("«худший» — больший, тем же правилом наоборот", () => {
    expect(pickReroll([73, 12], "keepWorst")).toEqual({ value: 73, index: 0, dropped: [12] });
  });

  it("три броска и больше тоже разбираются", () => {
    expect(pickReroll([55, 9, 88], "keepBest")).toMatchObject({ value: 9, index: 1 });
    expect(pickReroll([55, 9, 88], "keepWorst")).toMatchObject({ value: 88, index: 2 });
  });

  it("равные значения — оставляем первый, чтобы результат не плясал", () => {
    expect(pickReroll([40, 40], "keepBest")).toMatchObject({ value: 40, index: 0 });
  });

  it("один бросок — он же и результат, отброшенных нет", () => {
    expect(pickReroll([31], "keepBest")).toEqual({ value: 31, index: 0, dropped: [] });
  });

  it("режим по умолчанию — «лучший»", () => {
    expect(pickReroll([73, 12]).value).toBe(12);
  });

  it("пустой список — null, а не исключение посреди броска", () => {
    expect(pickReroll([], "keepBest")).toBeNull();
    expect(pickReroll(undefined, "keepBest")).toBeNull();
  });
});
