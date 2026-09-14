// test/rules/sundering.test.mjs
//
// Sundering / Разделение (wdbc-1rno, Тзинч): чистая логика клона (S/T−20,
// 9 Ран, Размер−1) и даунгрейда урона копий (1d10→1d5→плоское число).
// Спавн/токены/инициатива/откат в конце сцены — Foundry-склейка,
// module/combat/sundering.mjs, интеграционные тесты там же.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { sunderingCloneSystem, sunderingCloneTraits, sunderingDamageFormula }
  from "../../module/rules/sundering.mjs";

describe("sunderingCloneSystem", () => {
  const championSystem = () => ({
    characteristics: {
      s: { base: 35, advance: 5, supernatural: 0, bonusFx: 0 },
      t: { base: 40, advance: 0, supernatural: 0, bonusFx: 0 },
      ag: { base: 30, advance: 0, supernatural: 0, bonusFx: 0 }
    },
    wounds: { value: 12, max: 15, critical: -2 },
    size: 0
  });

  it("−20 S/T в base, остальные характеристики нетронуты", () => {
    const clone = sunderingCloneSystem(championSystem());
    expect(clone.characteristics.s.base).toBe(15);
    expect(clone.characteristics.t.base).toBe(20);
    expect(clone.characteristics.ag.base).toBe(30);
  });

  it("не уводит base ниже 0", () => {
    const sys = championSystem();
    sys.characteristics.s.base = 10;
    const clone = sunderingCloneSystem(sys);
    expect(clone.characteristics.s.base).toBe(0);
  });

  it("9 Ран целиком (value=max=9), Критические сброшены", () => {
    const clone = sunderingCloneSystem(championSystem());
    expect(clone.wounds).toEqual({ value: 9, max: 9, critical: 0 });
  });

  it("Размер −1", () => {
    const clone = sunderingCloneSystem(championSystem());
    expect(clone.size).toBe(-1);
  });

  it("не мутирует исходный объект чемпиона", () => {
    const sys = championSystem();
    sunderingCloneSystem(sys);
    expect(sys.characteristics.s.base).toBe(35);
    expect(sys.wounds.max).toBe(15);
  });

  it("отсутствующие/нечисловые поля не роняют расчёт", () => {
    const clone = sunderingCloneSystem({ characteristics: {} });
    expect(clone.characteristics.s.base).toBe(0);
    expect(clone.characteristics.t.base).toBe(0);
    expect(clone.size).toBe(-1);
  });
});

describe("sunderingCloneTraits", () => {
  it("три Трейта книги, Демонический несёт рейтинг +1", () => {
    const traits = sunderingCloneTraits();
    expect(traits).toHaveLength(3);
    expect(traits.every(t => t.type === "trait")).toBe(true);
    const daemonic = traits.find(t => t.name.includes("Daemonic"));
    expect(daemonic.system.hasRating).toBe(true);
    expect(daemonic.system.rating).toBe(1);
  });
});

describe("sunderingDamageFormula", () => {
  it("1d10 → 1 (через промежуточный 1d5)", () => {
    expect(sunderingDamageFormula("1d10")).toBe("1");
  });

  it("1d10+3 → 1+3", () => {
    expect(sunderingDamageFormula("1d10+3")).toBe("1+3");
  });

  it("2d10 → 2 (N костей → N очков, не общая единица)", () => {
    expect(sunderingDamageFormula("2d10")).toBe("2");
  });

  it("уже 1d5 в исходной формуле — тоже становится 1", () => {
    expect(sunderingDamageFormula("1d5+2")).toBe("1+2");
  });

  it("другие грани (d3, d100) не трогаются", () => {
    expect(sunderingDamageFormula("1d3+1d100")).toBe("1d3+1d100");
  });

  it("пустая/отсутствующая формула — как есть", () => {
    expect(sunderingDamageFormula("")).toBe("");
    expect(sunderingDamageFormula(null)).toBe(null);
  });
});
