// test/rules/roll-outcome.test.mjs
//
// Фаза 5b конвейера — исход броска против порога. Проверяется без Foundry:
// сам бросок кубика тут не участвует, только арифметика книги.

import { describe, it, expect } from "vitest";
import { testOutcome, criticalOutcome } from "../../module/rules/roll-outcome.mjs";

describe("testOutcome", () => {
  it("бросок равный порогу — успех с 1 степенью", () => {
    expect(testOutcome(45, 45)).toEqual({ success: true, deg: 1 });
  });

  it("бросок на 1 ниже порога — успех с 1 степенью", () => {
    expect(testOutcome(44, 45)).toEqual({ success: true, deg: 1 });
  });

  it("бросок на 1 выше порога — провал с 1 степенью", () => {
    expect(testOutcome(46, 45)).toEqual({ success: false, deg: 1 });
  });

  it("степень успеха растёт на каждые 10 очков запаса", () => {
    expect(testOutcome(5, 45).deg).toBe(5);   // запас 40 → 4 полных десятка + 1
    expect(testOutcome(15, 45).deg).toBe(4);
    expect(testOutcome(25, 45).deg).toBe(3);
  });

  it("степень провала растёт на каждые 10 очков перебора", () => {
    expect(testOutcome(56, 45).deg).toBe(2);
    expect(testOutcome(66, 45).deg).toBe(3);
    expect(testOutcome(95, 45).deg).toBe(6);
  });

  it("autoSuccess засчитывает успех при формальном провале броска", () => {
    const { success, deg } = testOutcome(80, 45, { autoSuccess: true });
    expect(success).toBe(true);
    expect(deg).toBe(1);
  });

  it("autoSuccess не убавляет степень, если бросок и так был успешным", () => {
    expect(testOutcome(10, 45, { autoSuccess: true })).toEqual({ success: true, deg: 4 });
  });

  it("без autoSuccess перебор броска — обычный провал", () => {
    expect(testOutcome(80, 45)).toEqual({ success: false, deg: 4 });
  });
});

describe("criticalOutcome", () => {
  it("натуральные 1-5 — Критический Успех по умолчанию", () => {
    expect(criticalOutcome(1)).toEqual({ success: true, failure: false });
    expect(criticalOutcome(5)).toEqual({ success: true, failure: false });
  });

  it("натуральные 96-100 — Критический Провал по умолчанию", () => {
    expect(criticalOutcome(96)).toEqual({ success: false, failure: true });
    expect(criticalOutcome(100)).toEqual({ success: false, failure: true });
  });

  it("вне диапазона — ни то ни другое", () => {
    expect(criticalOutcome(6)).toEqual({ success: false, failure: false });
    expect(criticalOutcome(95)).toEqual({ success: false, failure: false });
    expect(criticalOutcome(50)).toEqual({ success: false, failure: false });
  });

  it("не зависит от Предела — только от натурального броска", () => {
    // Критический Провал даже если бросок формально прошёл бы обычный тест.
    expect(criticalOutcome(97)).toEqual({ success: false, failure: true });
  });

  it("successExtra расширяет диапазон Критического Успеха", () => {
    expect(criticalOutcome(10, { successExtra: 5 })).toEqual({ success: true, failure: false });
    expect(criticalOutcome(11, { successExtra: 5 })).toEqual({ success: false, failure: false });
  });

  it("failExtra расширяет диапазон Критического Провала", () => {
    expect(criticalOutcome(91, { failExtra: 5 })).toEqual({ success: false, failure: true });
    expect(criticalOutcome(90, { failExtra: 5 })).toEqual({ success: false, failure: false });
  });
});
