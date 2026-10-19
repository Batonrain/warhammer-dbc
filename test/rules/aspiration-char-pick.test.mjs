// test/rules/aspiration-char-pick.test.mjs
//
// «Совершенство» (стр. 22): +5 одной Характеристике по выбору, −3 двум другим.

import { describe, it, expect } from "vitest";
import { normalizeCharPick, validateCharPick, charPickChanges, charPickState } from "../../module/rules/aspiration-char-pick.mjs";

const KEYS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel", "inf"];
const RULE = { plus: 5, minus: 3, minusCount: 2 };

describe("normalizeCharPick", () => {
  it("читает правило книги", () => {
    expect(normalizeCharPick(RULE)).toEqual({ plus: 5, minus: 3, minusCount: 2 });
  });
  it("мусор и неполное правило — нет выбора", () => {
    expect(normalizeCharPick(null)).toBeNull();
    expect(normalizeCharPick("x")).toBeNull();
    expect(normalizeCharPick({ plus: 5, minus: 3 })).toBeNull();
    expect(normalizeCharPick({ plus: 5, minus: 3, minusCount: 0 })).toBeNull();
  });
  it("знак в данных не важен: штраф всегда вычитается, бонус складывается", () => {
    expect(normalizeCharPick({ plus: 5, minus: -3, minusCount: 2 }).minus).toBe(3);
  });
});

describe("validateCharPick", () => {
  it("верный ответ проходит", () => {
    expect(validateCharPick(RULE, { plus: "s", minus: ["ag", "int"] }, KEYS).ok).toBe(true);
  });
  it("плюс и минус на одной Характеристике — нельзя", () => {
    expect(validateCharPick(RULE, { plus: "s", minus: ["s", "int"] }, KEYS).ok).toBe(false);
  });
  it("две одинаковые Характеристики под штраф — нельзя", () => {
    expect(validateCharPick(RULE, { plus: "s", minus: ["ag", "ag"] }, KEYS).ok).toBe(false);
  });
  it("штрафов не два — нельзя", () => {
    expect(validateCharPick(RULE, { plus: "s", minus: ["ag"] }, KEYS).ok).toBe(false);
    expect(validateCharPick(RULE, { plus: "s", minus: ["ag", "int", "per"] }, KEYS).ok).toBe(false);
  });
  it("неизвестная Характеристика — нельзя", () => {
    expect(validateCharPick(RULE, { plus: "zz", minus: ["ag", "int"] }, KEYS).ok).toBe(false);
    expect(validateCharPick(RULE, { plus: "s", minus: ["ag", "zz"] }, KEYS).ok).toBe(false);
  });
  it("без правила — нельзя", () => {
    expect(validateCharPick(null, { plus: "s", minus: ["ag", "int"] }, KEYS).ok).toBe(false);
  });
});

describe("charPickChanges", () => {
  it("+5 выбранной, −3 каждой из двух других — в порядке книги", () => {
    expect(charPickChanges(RULE, { plus: "wp", minus: ["fel", "ag"] }, KEYS)).toEqual([
      { charKey: "wp", op: "add", value: 5 },
      { charKey: "fel", op: "subtract", value: 3 },
      { charKey: "ag", op: "subtract", value: 3 }
    ]);
  });
  it("неверный ответ не даёт частичного результата", () => {
    expect(charPickChanges(RULE, { plus: "wp", minus: ["wp", "ag"] }, KEYS)).toEqual([]);
  });
});

describe("charPickState", () => {
  it("нет правила — выбор не нужен", () => {
    expect(charPickState(null, null)).toBe("none");
    expect(charPickState(undefined, { plus: "s", minus: ["ag", "int"] })).toBe("none");
  });
  it("правило есть, ответа нет — нужен (запись выдана до появления выбора)", () => {
    expect(charPickState(RULE, null)).toBe("needed");
    expect(charPickState(RULE, undefined)).toBe("needed");
  });
  it("правило и ответ — выбран", () => {
    expect(charPickState(RULE, { plus: "s", minus: ["ag", "int"] })).toBe("chosen");
  });
});
