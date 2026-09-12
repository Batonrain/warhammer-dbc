// test/rules/blessed-fits.test.mjs
//
// Blessed Fits / Благословенные Припадки (wdbc-1rno, Общие Мутации):
// чистая логика «пора ли вернуть Очко Бесчестия». Триггер Оглушения (в
// hooks.mjs::btnReroll) и сам возврат (combat/condition-ticks.mjs) —
// интеграционные тесты в соответствующих файлах.

import { describe, it, expect } from "vitest";
import { blessedFitsRefundDue } from "../../module/rules/blessed-fits.mjs";

describe("blessedFitsRefundDue", () => {
  it("метка стоит, счётчик дошёл до 0 — пора возвращать", () => {
    expect(blessedFitsRefundDue(true, 0)).toBe(true);
  });

  it("метка стоит, счётчик ушёл в отрицательное (клэмп ниже) — тоже пора", () => {
    expect(blessedFitsRefundDue(true, -1)).toBe(true);
  });

  it("метка стоит, но счётчик ещё не дошёл до 0 — рано", () => {
    expect(blessedFitsRefundDue(true, 1)).toBe(false);
  });

  it("метки нет вовсе — не возвращать, даже если счётчик на 0", () => {
    expect(blessedFitsRefundDue(false, 0)).toBe(false);
    expect(blessedFitsRefundDue(undefined, 0)).toBe(false);
    expect(blessedFitsRefundDue(null, 0)).toBe(false);
  });
});
