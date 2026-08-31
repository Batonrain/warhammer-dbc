// test/combat/narrative-speed.test.mjs
//
// Нарративная скорость по SPD (стр. 29): таблица опорных точек с линейной
// интерполяцией между ними и экстраполяцией за последним отрезком.

// Модуль вешает Hooks при загрузке — нужна заглушка Foundry.
import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { narrativeSpeed } from "../../module/combat/movement-actions.mjs";

describe("narrativeSpeed", () => {
  it("точка таблицы отдаётся как есть: SPD 4 → 6 км/ч", () => {
    expect(narrativeSpeed(4).perHour).toBe(6);
  });

  it("между точками — линейная интерполяция: SPD 4.5 → 6.5 км/ч (между 6 и 7)", () => {
    expect(narrativeSpeed(4.5).perHour).toBe(6.5);
  });

  it("за последней точкой — наклон последнего отрезка: SPD 12 → 14 + 2×1 = 16 км/ч", () => {
    expect(narrativeSpeed(12).perHour).toBe(16);
  });

  it("ниже первой точки — пропорционально ей: SPD 0.25 → 0.5 км/ч; пустой SPD → 0.5", () => {
    expect(narrativeSpeed(0.25).perHour).toBe(0.5);
    expect(narrativeSpeed(0).perHour).toBe(1);   // Number(0)||0.5 → SPD 0.5 → 1 км/ч
  });

  it("производные: в минуту SPD×24, в день ×10, ускоренный марш ×2, бег ×3", () => {
    expect(narrativeSpeed(4)).toEqual({ perMinute: 96, perHour: 6, perDay: 60, perDayX2: 120, perHourX3: 18 });
  });
});
