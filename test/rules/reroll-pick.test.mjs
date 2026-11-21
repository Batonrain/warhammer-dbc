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

describe("pickReroll — обязательный переброс Успеха/Провала (Расчленитель)", () => {
  const ok = v => v <= 50;
  it("rerollSuccess: Успех перебрасывается, остаётся новый бросок даже хуже", () => {
    expect(pickReroll([20, 90], "rerollSuccess", { isSuccess: ok })).toEqual({ value: 90, index: 1, dropped: [20] });
    expect(pickReroll([20, 10], "rerollSuccess", { isSuccess: ok })).toEqual({ value: 10, index: 1, dropped: [20] });
  });
  it("rerollSuccess: Провал остаётся, второй кубик не в счёт", () => {
    expect(pickReroll([70, 5], "rerollSuccess", { isSuccess: ok })).toEqual({ value: 70, index: 0, dropped: [] });
  });
  it("rerollFail: Провал перебрасывается, остаётся новый", () => {
    expect(pickReroll([70, 99], "rerollFail", { isSuccess: ok })).toEqual({ value: 99, index: 1, dropped: [70] });
    expect(pickReroll([30, 99], "rerollFail", { isSuccess: ok })).toEqual({ value: 30, index: 0, dropped: [] });
  });
  it("без isSuccess исход не известен — остаётся исходный", () => {
    expect(pickReroll([20, 90], "rerollSuccess").value).toBe(20);
  });
});
