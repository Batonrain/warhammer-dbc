// test/rules/test-kind.test.mjs
//
// Вид теста (стр. 25-26) — чистая арифметика Комбинированного, Встречного и
// Кубика (Переброс/Преимущество/Помеха), без Foundry.

import { describe, it, expect } from "vitest";
import { combinedThreshold, resolveOpposed, diceModeFor } from "../../module/rules/test-kind.mjs";

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

  // Сверхъестественная Характеристика (стр. 26, wdbc-y9i8) — пример 2 книги:
  // Трорзак (5 Успехов, без Трейта) vs Амелия (3 Успеха, Unnatural W (2)).
  // По сырым Успехам Трорзак впереди — но раз проигрывающая (по Успехам)
  // сторона владеет Трейтом, а победившая — нет, исход гасится до ничьей по
  // Пределу, независимо от того, чей Предел выше.
  it("пример 2 книги: Предел проигравшей (по сырым Успехам) стороны выше — она побеждает вопреки меньшему числу Успехов", () => {
    const trorzak = { deg: 5, success: true, threshold: 40, unnatural: false };
    const amelia  = { deg: 3, success: true, threshold: 55, unnatural: true };
    expect(resolveOpposed(trorzak, amelia)).toEqual({ winner: "theirs", margin: 1, unnaturalTieBreak: true });
  });

  it("пример 2 книги (продолжение): Предел «победителя по Успехам» выше — он всё равно побеждает, но margin 1, а не 2", () => {
    const trorzak = { deg: 5, success: true, threshold: 55, unnatural: false };
    const amelia  = { deg: 3, success: true, threshold: 40, unnatural: true };
    expect(resolveOpposed(trorzak, amelia)).toEqual({ winner: "mine", margin: 1, unnaturalTieBreak: true });
  });

  it("Unnatural есть у ОБЕИХ сторон — тай-брейк не срабатывает, margin обычный", () => {
    const mine   = { deg: 5, success: true, threshold: 40, unnatural: true };
    const theirs = { deg: 3, success: true, threshold: 55, unnatural: true };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: "mine", margin: 2 });
  });

  it("Unnatural есть только у ПОБЕДИВШЕЙ (по Успехам) стороны — тай-брейк не для неё, margin обычный", () => {
    const mine   = { deg: 5, success: true, threshold: 40, unnatural: true };
    const theirs = { deg: 3, success: true, threshold: 55, unnatural: false };
    expect(resolveOpposed(mine, theirs)).toEqual({ winner: "mine", margin: 2 });
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
