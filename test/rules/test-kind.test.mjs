// test/rules/test-kind.test.mjs
//
// Вид теста (стр. 25-26) — чистая арифметика Комбинированного, Встречного и
// Кубика (Переброс/Преимущество/Помеха), без Foundry.

import { describe, it, expect } from "vitest";
import { TEST_KINDS, combinedThreshold, resolveOpposed, diceModeFor } from "../../module/rules/test-kind.mjs";

describe("TEST_KINDS", () => {
  it("пять видов теста с русскими подписями", () => {
    expect(Object.keys(TEST_KINDS)).toEqual(["base", "opposed", "opposedSafe", "combined", "extended"]);
    expect(TEST_KINDS.base).toBe("Базовый");
  });
});

describe("combinedThreshold", () => {
  it("берёт наименьший из двух Пределов", () => {
    expect(combinedThreshold(87, 77)).toBe(77);
    expect(combinedThreshold(30, 90)).toBe(30);
  });
});

describe("resolveOpposed", () => {
  it("оба преуспели — margin равен разнице степеней (пример книги, Малфас)", () => {
    const mine = { deg: 6, success: true, threshold: 70 };
    const theirs = { deg: 4, success: true, threshold: 70 };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: "mine", margin: 2 });
  });

  it("успех против провала — margin складывает обе степени (пример книги)", () => {
    const mine = { deg: 3, success: true, threshold: 60 };
    const theirs = { deg: 2, success: false, threshold: 60 };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: "mine", margin: 5 });
  });

  it("оба провалили — побеждает тот, у кого меньше Провалов", () => {
    const mine = { deg: 2, success: false, threshold: 40 };
    const theirs = { deg: 4, success: false, threshold: 40 };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: "mine", margin: 2 });
  });

  it("равная степень — решает более высокий Предел, победа с 1 степенью", () => {
    const mine = { deg: 3, success: true, threshold: 80 };
    const theirs = { deg: 3, success: true, threshold: 50 };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: "mine", margin: 1 });
  });

  it("равная степень и равный Предел — полная ничья, решает ГМ", () => {
    const mine = { deg: 2, success: true, threshold: 60 };
    const theirs = { deg: 2, success: true, threshold: 60 };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: null, margin: 0 });
  });

  it("безопасный (vss): Провалы проигравшего не идут в margin победителя", () => {
    const mine = { deg: 3, success: true, threshold: 60 };
    const theirs = { deg: 2, success: false, threshold: 60 };
    expect(resolveOpposed(mine, theirs, { safe: true })).toEqual({ winner: "mine", margin: 3 });
  });

  it("безопасный (vss): оба преуспели — та же формула, что у обычного встречного", () => {
    const mine = { deg: 6, success: true, threshold: 70 };
    const theirs = { deg: 4, success: true, threshold: 70 };
    expect(resolveOpposed(mine, theirs, { safe: true })).toEqual({ winner: "mine", margin: 2 });
  });
});

describe("diceModeFor", () => {
  it("Преимущество — бросить дважды, взять лучший", () => {
    expect(diceModeFor("advantage")).toEqual({ rolls: 2, mode: "keepBest" });
  });

  it("Помеха — бросить дважды, взять худший", () => {
    expect(diceModeFor("disadvantage")).toEqual({ rolls: 2, mode: "keepWorst" });
  });

  it("обычный бросок — null", () => {
    expect(diceModeFor("normal")).toBeNull();
    expect(diceModeFor(undefined)).toBeNull();
  });
});
