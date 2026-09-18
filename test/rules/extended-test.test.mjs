// test/rules/extended-test.test.mjs
//
// Расширенный тест (стр. 25) — арифметика Банка Успехов, без Foundry (само
// хранение — актор-флаг, дело module/sheets/actor-sheet.mjs).

import { describe, it, expect } from "vitest";
import { extendedTestKey, applyGain, extendedTestRows } from "../../module/rules/extended-test.mjs";

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

// extendedTestRows — панель «Расширенные тесты» на вкладке ПОКАЗАТЕЛИ
// (wdbc-nysl): чистое преобразование flags.warhammer-dbc.extendedTests в
// список для отображения, без Foundry.
describe("extendedTestRows", () => {
  it("пустой/отсутствующий объект флагов — пустой список", () => {
    expect(extendedTestRows(null)).toEqual([]);
    expect(extendedTestRows({})).toEqual([]);
  });

  it("читает label/testKey и считает done по цели", () => {
    const rows = extendedTestRows({
      вязь_зарока: { accumulated: 5, target: 30, label: "Вязь Зарока", testKey: "skill:scholLore" },
      готово: { accumulated: 10, target: 10, label: "Готово", testKey: "char:wp" }
    });
    expect(rows).toEqual([
      { key: "вязь_зарока", label: "Вязь Зарока", accumulated: 5, target: 30, testKey: "skill:scholLore", done: false },
      { key: "готово", label: "Готово", accumulated: 10, target: 10, testKey: "char:wp", done: true }
    ]);
  });

  it("без сохранённого label подставляет ключ", () => {
    const rows = extendedTestRows({ старый: { accumulated: 2, target: 10 } });
    expect(rows).toEqual([{ key: "старый", label: "старый", accumulated: 2, target: 10, testKey: null, done: false }]);
  });

  it("сортирует по названию (алфавит)", () => {
    const rows = extendedTestRows({
      б: { label: "Бета", accumulated: 0, target: 1 },
      а: { label: "Альфа", accumulated: 0, target: 1 }
    });
    expect(rows.map(r => r.label)).toEqual(["Альфа", "Бета"]);
  });
});
