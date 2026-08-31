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
  it.each([
    ["оба преуспели — margin равен разнице степеней (пример книги, Малфас)",
      { deg: 6, success: true, threshold: 70 }, { deg: 4, success: true, threshold: 70 }, {},
      { winner: "mine", margin: 2 }],
    ["успех против провала — margin складывает обе степени (пример книги)",
      { deg: 3, success: true, threshold: 60 }, { deg: 2, success: false, threshold: 60 }, {},
      { winner: "mine", margin: 5 }],
    ["оба провалили — побеждает тот, у кого меньше Провалов",
      { deg: 2, success: false, threshold: 40 }, { deg: 4, success: false, threshold: 40 }, {},
      { winner: "mine", margin: 2 }],
    ["равная степень — решает более высокий Предел, победа с 1 степенью",
      { deg: 3, success: true, threshold: 80 }, { deg: 3, success: true, threshold: 50 }, {},
      { winner: "mine", margin: 1 }],
    ["равная степень и равный Предел — полная ничья, решает ГМ",
      { deg: 2, success: true, threshold: 60 }, { deg: 2, success: true, threshold: 60 }, {},
      { winner: null, margin: 0 }],
    ["безопасный (vss): Провалы проигравшего не идут в margin победителя",
      { deg: 3, success: true, threshold: 60 }, { deg: 2, success: false, threshold: 60 }, { safe: true },
      { winner: "mine", margin: 3 }],
    ["безопасный (vss): оба преуспели — та же формула, что у обычного встречного",
      { deg: 6, success: true, threshold: 70 }, { deg: 4, success: true, threshold: 70 }, { safe: true },
      { winner: "mine", margin: 2 }]
  ])("%s", (_title, mine, theirs, opts, expected) => {
    expect(resolveOpposed(mine, theirs, opts)).toEqual(expected);
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
