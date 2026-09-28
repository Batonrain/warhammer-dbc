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

  // Книга развела расы: у Человека Inf 19, у недочеловеков главы I (Скват,
  // Репликант, Огрин, Ратлинг, Зверолюд) — 14 (сверка главы I, 28.09.2026).
  // Формула это переживает; проверка следит, что база берётся у расы.
  it("у Человека база Бесчестия 19, у Сквата, Репликанта и Ратлинга — 14 по книге", () => {
    expect(RACES.human.chars.inf).toBe(19);
    expect(RACES.squat.chars.inf).toBe(14);
    expect(RACES.replicant.chars.inf).toBe(14);
    expect(RACES.ratling.chars.inf).toBe(14);
    expect(startingInfamyFormula(RACES.replicant.chars.inf, true)).toBe("14+1d5");
  });
});
