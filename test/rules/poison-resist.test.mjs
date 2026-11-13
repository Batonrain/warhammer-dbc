// test/rules/poison-resist.test.mjs
//
// Спасбросок цели против яда-препарата (wdbc-x1nz.4, книга «Яды»): чистая
// арифметика модификатора Качества и слагаемого теста. Без Foundry.

import { describe, it, expect } from "vitest";
import { poisonQualityTestMod, poisonResistPart } from "../../module/rules/poison-resist.mjs";

describe("poisonQualityTestMod", () => {
  it("книжная таблица: Poor +10, Common 0, Good −10, Best −20", () => {
    expect(poisonQualityTestMod("poor")).toBe(10);
    expect(poisonQualityTestMod("common")).toBe(0);
    expect(poisonQualityTestMod("good")).toBe(-10);
    expect(poisonQualityTestMod("best")).toBe(-20);
  });

  it("неизвестное/пустое Качество — нормализуется к common (0)", () => {
    expect(poisonQualityTestMod(undefined)).toBe(0);
    expect(poisonQualityTestMod("")).toBe(0);
    expect(poisonQualityTestMod("artisan")).toBe(0); // друкхарийского уровня у ядов не бывает — common
  });
});

describe("poisonResistPart", () => {
  it("по умолчанию — характеристика T, мод из poisonTestMod + Качество", () => {
    expect(poisonResistPart({ poisonTestMod: 5, quality: "good" }))
      .toEqual({ charKey: "t", mod: 5 - 10 });
  });

  it("характеристика берётся с предмета (poisonTestChar)", () => {
    expect(poisonResistPart({ poisonTestChar: "ws", poisonTestMod: 0, quality: "common" }))
      .toEqual({ charKey: "ws", mod: 0 });
  });

  it("Poor.Q облегчает тест цели: +10 к модификатору", () => {
    expect(poisonResistPart({ poisonTestMod: -10, quality: "poor" }))
      .toEqual({ charKey: "t", mod: 0 });
  });

  it("нет system вовсе — не падает, мод 0, характеристика t", () => {
    expect(poisonResistPart(undefined)).toEqual({ charKey: "t", mod: 0 });
  });
});
