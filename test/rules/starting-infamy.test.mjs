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

  // Книга разводит расы по базе: у Человека 19, у Наги 24 (таблица
  // «Стартовые Характеристики», столбец Inf; в паке так и было). Прежнее
  // «у всех рас 19» держалось только потому, что резерв-константы рас были
  // заглушкой 25/19 — сверка главы I выставляет книжные числа раса за расой
  // (у Огрина в паке 14, в константе ещё 19 — это его сверка).
  it("база Бесчестия берётся у расы: Человек 19, Нага 24 — как в паке", () => {
    const packInf = new Map(packDocuments("races", "race").map(({ doc }) => [doc.system?.key, doc.system?.chars?.inf]));
    expect(RACES.human.chars.inf).toBe(19);
    expect(packInf.get("human")).toBe(19);
    expect(RACES.naga.chars.inf).toBe(24);
    expect(packInf.get("naga")).toBe(24);
  });
});
