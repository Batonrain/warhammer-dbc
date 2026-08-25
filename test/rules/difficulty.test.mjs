// test/rules/difficulty.test.mjs
//
// Единая таблица Сложности (стр. 26) — чистые данные, без Foundry.

import { describe, it, expect } from "vitest";
import { DIFFICULTY_STEPS, DEFAULT_DIFFICULTY, isKnownDifficulty } from "../../module/rules/difficulty.mjs";

describe("DIFFICULTY_STEPS", () => {
  it("одиннадцать шагов от +40 до −60 с шагом 10, как в книге", () => {
    expect(DIFFICULTY_STEPS).toHaveLength(11);
    expect(DIFFICULTY_STEPS[0].value).toBe(40);
    expect(DIFFICULTY_STEPS.at(-1).value).toBe(-60);
    for (let i = 1; i < DIFFICULTY_STEPS.length; i++) {
      expect(DIFFICULTY_STEPS[i - 1].value - DIFFICULTY_STEPS[i].value).toBe(10);
    }
  });

  it("значение по умолчанию — центр таблицы, без модификатора", () => {
    expect(DEFAULT_DIFFICULTY).toBe(0);
    expect(isKnownDifficulty(0)).toBe(true);
  });

  it("isKnownDifficulty отвергает значение вне таблицы", () => {
    expect(isKnownDifficulty(15)).toBe(false);
    expect(isKnownDifficulty(-70)).toBe(false);
  });
});
