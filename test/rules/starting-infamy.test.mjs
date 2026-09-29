// test/rules/starting-infamy.test.mjs
//
// Стартовое Бесчестие персонажа (корбук стр. 4): базовое для расы +1d5 при
// Генерации Характеристик или +2 при распределении.
//
// База берётся из расы, а не вписана числом: у книжных рас она 19 — отсюда
// привычное «19 + 1d5», — но раса с другой базой должна считаться правильно, и
// проверка следит именно за этим.

import { describe, it, expect } from "vitest";
import { startingInfamyFormula, INFAMY_GEN_BONUS, INFAMY_FLAT_BONUS } from "../../module/rules/starting-infamy.mjs";
import { RACES } from "../../module/constants/races.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

describe("стартовое Бесчестие", () => {
  it("Генерация даёт формулу для броска", () => {
    expect(startingInfamyFormula(19, true)).toBe("19+1d5");
    expect(INFAMY_GEN_BONUS).toBe("1d5");
  });

  it("распределение даёт готовое число — бросать там нечего", () => {
    expect(startingInfamyFormula(19, false)).toBe(21);
    expect(INFAMY_FLAT_BONUS).toBe(2);
  });

  it("база берётся у расы, а не подразумевается", () => {
    expect(startingInfamyFormula(25, true)).toBe("25+1d5");
    expect(startingInfamyFormula(25, false)).toBe(27);
  });

  it("пустая база не ломает формулу", () => {
    expect(startingInfamyFormula(undefined, true)).toBe("0+1d5");
    expect(startingInfamyFormula(null, false)).toBe(2);
  });

  // Книга развела расы по разной базе (Огрин — 14, сверка главы I 28.09.2026),
  // поэтому «19 у всех» больше не инвариант. Инвариант другой: резерв-константы
  // несут ту же базу, что документ расы в паке, — иначе без пака Мастер создания
  // считал бы Бесчестие не по книге.
  // Резерв-константы этих рас ещё не сверены с паком — сверив расу, уберите
  // её из списка.
  const NOT_YET_RECONCILED = [];
  it("база Бесчестия в резерв-константах совпадает с документом расы в паке", () => {
    const packInf = new Map(packDocuments("races", "race").map(({ doc }) => [doc.system?.key, doc.system?.chars?.inf]));
    const diff = Object.entries(RACES)
      .filter(([key, r]) => !NOT_YET_RECONCILED.includes(key))
      .filter(([key, r]) => r.chars?.inf !== undefined && packInf.has(key) && packInf.get(key) !== r.chars.inf)
      .map(([key, r]) => `${key}: константы ${r.chars.inf}, пак ${packInf.get(key)}`);
    expect(diff).toEqual([]);
  });
});
