// test/constants/psyker-sigillite-subpaths.test.mjs
//
// wdbc-qd6w: Путь «Руны Сигиллитов» — единственная запись PSY_PATHS, где книга
// (packs-src/books/toad-psykers.json, стр. 101-102) прямо разрешает СКЛАДЫВАТЬ
// механику нескольких других Путей одновременно («может использовать механику
// всех следующих путей ОДНОВРЕМЕННО… псайкер может определять желаемые») —
// вместо обычного взаимоисключающего выбора одного Пути. subPathTotals читает
// числа Инкантации/Медитации/Нечестивых Символов из тех же записей PSY_PATHS,
// не копируя их второй раз.

import { describe, it, expect } from "vitest";
import { PSY_PATHS, subPathTotals } from "../../module/constants/psyker.mjs";

describe("PSY_PATHS.sigillite — subPaths (wdbc-qd6w)", () => {
  it("объявляет ровно три суб-механики книги", () => {
    expect(PSY_PATHS.sigillite.subPaths).toEqual(["incantation", "meditation", "unholy"]);
  });

  it("базовые числа самой записи sigillite остаются нулевыми — весь эффект даёт subPathTotals", () => {
    expect(PSY_PATHS.sigillite.ePR).toBe(0);
    expect(PSY_PATHS.sigillite.testMod).toBe(0);
    expect(PSY_PATHS.sigillite.phenMod).toBe(0);
  });
});

describe("subPathTotals — ничего не отмечено (только базовый Best.Q Психофокус)", () => {
  it("пустой список — все нули", () => {
    expect(subPathTotals("sigillite", [])).toEqual({ ePR: 0, testMod: 0, phenMod: 0, labels: [] });
  });

  it("undefined/не-массив — тоже все нули, а не падение", () => {
    expect(subPathTotals("sigillite", undefined)).toEqual({ ePR: 0, testMod: 0, phenMod: 0, labels: [] });
    expect(subPathTotals("sigillite", null)).toEqual({ ePR: 0, testMod: 0, phenMod: 0, labels: [] });
  });
});

describe("subPathTotals — одна суб-механика", () => {
  it("только Инкантация: +1 эPR, +20 Феномен", () => {
    const r = subPathTotals("sigillite", ["incantation"]);
    expect(r.ePR).toBe(1);
    expect(r.phenMod).toBe(20);
    expect(r.testMod).toBe(0);
    expect(r.labels).toEqual(["Инкантация"]);
  });

  it("только Медитация: +3 эPR, Феномен не трогает", () => {
    const r = subPathTotals("sigillite", ["meditation"]);
    expect(r.ePR).toBe(3);
    expect(r.phenMod).toBe(0);
  });

  it("только Нечестивые Символы: −20 Феномен, эPR не трогает", () => {
    const r = subPathTotals("sigillite", ["unholy"]);
    expect(r.ePR).toBe(0);
    expect(r.phenMod).toBe(-20);
  });
});

describe("subPathTotals — комбинации складываются кумулятивно", () => {
  it("Инкантация + Медитация: эPR 1+3=4, Феномен +20", () => {
    const r = subPathTotals("sigillite", ["incantation", "meditation"]);
    expect(r.ePR).toBe(4);
    expect(r.phenMod).toBe(20);
  });

  it("Инкантация + Нечестивые Символы: Феномен +20−20=0 (книжный пример из тикета)", () => {
    const r = subPathTotals("sigillite", ["incantation", "unholy"]);
    expect(r.ePR).toBe(1);
    expect(r.phenMod).toBe(0);
  });

  it("Медитация + Нечестивые Символы: эPR +3, Феномен −20", () => {
    const r = subPathTotals("sigillite", ["meditation", "unholy"]);
    expect(r.ePR).toBe(3);
    expect(r.phenMod).toBe(-20);
  });

  it("все три сразу: эPR 1+3=4, Феномен 20−20=0", () => {
    const r = subPathTotals("sigillite", ["incantation", "meditation", "unholy"]);
    expect(r.ePR).toBe(4);
    expect(r.phenMod).toBe(0);
    expect(r.labels).toEqual(["Инкантация", "Медитация", "Нечестивые Символы"]);
  });

  it("порядок отметок не важен — сумма та же", () => {
    const r = subPathTotals("sigillite", ["unholy", "incantation", "meditation"]);
    expect(r.ePR).toBe(4);
    expect(r.phenMod).toBe(0);
  });
});

describe("subPathTotals — защита от рассинхрона данных", () => {
  it("ключ вне subPaths этого Пути (например 'meditation' как отдельный Путь) не в счёт для Пути без subPaths", () => {
    // У самого Пути "meditation" (одиночный выбор) subPaths нет вовсе —
    // подсунутые ключи не должны ничего сложить.
    expect(subPathTotals("meditation", ["incantation", "unholy"])).toEqual(
      { ePR: 0, testMod: 0, phenMod: 0, labels: [] });
  });

  it("неизвестный ключ тихо игнорируется, известные считаются", () => {
    const r = subPathTotals("sigillite", ["incantation", "not-a-real-key"]);
    expect(r.ePR).toBe(1);
    expect(r.labels).toEqual(["Инкантация"]);
  });

  it("несуществующий Путь — все нули, не падение", () => {
    expect(subPathTotals("no-such-path", ["incantation"])).toEqual(
      { ePR: 0, testMod: 0, phenMod: 0, labels: [] });
  });
});
