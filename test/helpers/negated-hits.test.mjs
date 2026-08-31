// test/helpers/negated-hits.test.mjs
//
// Уклонение/Парирование против атаки с несколькими попаданиями (Очередь,
// Быстрая/Молниеносная Атака, стр. 12): «может Избежать по одному попаданию
// за каждый Успех», не больше их числа. Провал не снимает ничего.

import { describe, it, expect } from "vitest";
import { negatedHits, _hitWord } from "../../module/helpers/utils.mjs";

describe("negatedHits", () => {
  it("одиночная атака (hitsCount=1): провал не снимает, успех снимает", () => {
    expect(negatedHits(false, 3, 1)).toEqual({ total: 1, negated: 0, remaining: 1 });
    expect(negatedHits(true, 1, 1)).toEqual({ total: 1, negated: 1, remaining: 0 });
    expect(negatedHits(true, 5, 1)).toEqual({ total: 1, negated: 1, remaining: 0 });
  });

  it("множественные попадания: снимает по одному за степень, не больше их числа", () => {
    expect(negatedHits(true, 2, 5)).toEqual({ total: 5, negated: 2, remaining: 3 });
    expect(negatedHits(true, 5, 5)).toEqual({ total: 5, negated: 5, remaining: 0 });
    expect(negatedHits(true, 9, 5)).toEqual({ total: 5, negated: 5, remaining: 0 });
  });

  it("провал множественной атаки — все попадания проходят", () => {
    expect(negatedHits(false, 4, 5)).toEqual({ total: 5, negated: 0, remaining: 5 });
  });

  it("hitsCount<1 считается как 1 (нет данных о числе попаданий)", () => {
    expect(negatedHits(true, 1, 0)).toEqual({ total: 1, negated: 1, remaining: 0 });
  });
});

describe("_hitWord", () => {
  it("склоняет «попадание» по числу", () => {
    expect(_hitWord(1)).toBe("попадание");
    expect(_hitWord(2)).toBe("попадания");
    expect(_hitWord(4)).toBe("попадания");
    expect(_hitWord(5)).toBe("попаданий");
    expect(_hitWord(11)).toBe("попаданий");
  });
});
