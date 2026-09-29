// test/rules/disorder-severity.test.mjs
//
// Тяжесть Ментального Расстройства (корбук, «Ментальные расстройства»):
// при получении 0, пределы −5…+5, все связанные с расстройством тесты
// получают −5×Тяжесть. Неизлечимое расстройство Беглого Псайкера («тяжесть
// не может опуститься ниже −2») — нижний предел severityMin.

import { describe, it, expect } from "vitest";
import { severityFloor, effectiveSeverity, severityTestMod, severityNote, stepSeverity }
  from "../../module/rules/disorder-severity.mjs";

describe("Тяжесть расстройства", () => {
  it("без своего предела — книжные −5…+5", () => {
    expect(severityFloor({})).toBe(-5);
    expect(effectiveSeverity({ severity: -9 })).toBe(-5);
    expect(effectiveSeverity({ severity: 7 })).toBe(5);
    expect(effectiveSeverity({})).toBe(0);
  });

  it("неизлечимое Беглого Псайкера не опускается ниже −2", () => {
    const sys = { severity: -4, severityMin: -2, incurable: true };
    expect(severityFloor(sys)).toBe(-2);
    expect(effectiveSeverity(sys)).toBe(-2);
    expect(stepSeverity(sys, -1)).toBe(-2);
    expect(stepSeverity({ ...sys, severity: -1 }, -1)).toBe(-2);
    expect(stepSeverity({ ...sys, severity: 4 }, +1)).toBe(5);
    expect(stepSeverity({ ...sys, severity: 5 }, +1)).toBe(5);
  });

  it("предел null или пустой — не предел", () => {
    expect(severityFloor({ severityMin: null })).toBe(-5);
    expect(severityFloor({ severityMin: "" })).toBe(-5);
    expect(severityFloor({ severityMin: 0 })).toBe(0);
  });

  it("модификатор теста −5×Тяжесть", () => {
    expect(severityTestMod({ severity: 2 })).toBe(-10);
    expect(severityTestMod({ severity: -2 })).toBe(10);
    expect(severityTestMod({ severity: 0 })).toBe(0);
    expect(severityTestMod({ severity: -4, severityMin: -2 })).toBe(10);
  });

  it("подпись: тяжесть, неизлечимость и предел", () => {
    expect(severityNote({ severity: 0 })).toBe("Тяжесть 0");
    expect(severityNote({ severity: 1, severityMin: -2, incurable: true }))
      .toBe("Тяжесть +1 · неизлечимо, не ниже −2");
    // Излечимое на −5 — книжное «преодолевает и излечивается»: подсказка ГМу.
    expect(severityNote({ severity: -5 })).toMatch(/излечивается/);
  });
});
