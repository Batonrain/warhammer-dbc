// test/combat/attack-threshold.test.mjs
//
// Фаза 4 конвейера — то, что диалог атаки делает с отмеченными галочками.
// Проверяется без Foundry: сложение модификаторов и ополовинивание штрафа — это
// правило книги, а не разметка окна.

import { describe, it, expect } from "vitest";
import { attackThreshold } from "../../module/combat/attack-threshold.mjs";

describe("attackThreshold", () => {
  it("модификаторы складываются с базовым порогом", () => {
    expect(attackThreshold({ base: 45, mods: [10, -20, 5] })).toBe(40);
  });

  it("без модификаторов порог не меняется", () => {
    expect(attackThreshold({ base: 45 })).toBe(45);
  });

  it("ополовинивание округляет штраф в пользу игрока: −25 даёт −12", () => {
    expect(attackThreshold({ base: 45, mods: [-25], halvePenalty: true })).toBe(33);
  });

  it("ополовинивание не трогает итоговый плюс", () => {
    expect(attackThreshold({ base: 45, mods: [20, -10], halvePenalty: true })).toBe(55);
  });

  it("ополовинивается сумма, а не каждый штраф по отдельности", () => {
    // −10 и −20 вместе дают −30 → −15, а не −5 и −10 = −15… совпало бы случайно,
    // поэтому берём пару, где порядок виден: −5 и −20 → −25 → −12.
    expect(attackThreshold({ base: 50, mods: [-5, -20], halvePenalty: true })).toBe(38);
  });

  it("пустые и нечисловые значения пропускаются", () => {
    expect(attackThreshold({ base: 45, mods: [10, null, undefined, NaN, "5"] })).toBe(60);
  });
});
