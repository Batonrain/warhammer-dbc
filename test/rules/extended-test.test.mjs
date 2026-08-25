// test/rules/extended-test.test.mjs
//
// Расширенный тест (стр. 25) — арифметика Банка Успехов, без Foundry (само
// хранение — актор-флаг, дело module/sheets/actor-sheet.mjs).

import { describe, it, expect } from "vitest";
import { extendedTestKey, applyGain } from "../../module/rules/extended-test.mjs";

describe("extendedTestKey", () => {
  it("пробелы и знаки препинания схлопываются в подчёркивание", () => {
    expect(extendedTestKey("Вязь на робе Зарока")).toBe("вязь_на_робе_зарока");
  });

  it("регистр не важен", () => {
    expect(extendedTestKey("Tech-Use")).toBe(extendedTestKey("tech-use"));
  });

  it("точки не остаются: иначе Foundry прочтёт их как путь", () => {
    expect(extendedTestKey("Sus.An.Heal")).not.toContain(".");
  });

  it("пустая строка не даёт пустой ключ", () => {
    expect(extendedTestKey("")).toBe("test");
    expect(extendedTestKey("   ")).toBe("test");
  });
});

describe("applyGain", () => {
  it("прибавляет выигрыш к банку", () => {
    expect(applyGain(5, 3, 30)).toEqual({ accumulated: 8, done: false });
  });

  it("done становится true, когда банк достиг цели", () => {
    expect(applyGain(27, 3, 30)).toEqual({ accumulated: 30, done: true });
    expect(applyGain(27, 5, 30)).toEqual({ accumulated: 32, done: true });
  });

  it("провал (gain 0) банк не трогает", () => {
    expect(applyGain(12, 0, 30)).toEqual({ accumulated: 12, done: false });
  });

  it("отрицательный gain (Критический Провал по решению ГМа) не уводит банк ниже нуля", () => {
    expect(applyGain(5, -15, 30)).toEqual({ accumulated: 0, done: false });
  });
});
