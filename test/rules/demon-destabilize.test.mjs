// test/rules/demon-destabilize.test.mjs
//
// Дестабилизация формы демона (корбук, «Формы призыва», wdbc-1rno) — чистая
// арифметика перевода {бросок, Завеса} → секунды до изгнания в Варп.

import { describe, it, expect } from "vitest";
import { destabilizeRungSeconds, destabilizeDurationSeconds } from "../../module/rules/demon-destabilize.mjs";

describe("destabilizeRungSeconds — ступень по Завесе", () => {
  it("Завеса 0 или отрицательная — база, Раунды (6с)", () => {
    expect(destabilizeRungSeconds(0)).toBe(6);
    expect(destabilizeRungSeconds(-3)).toBe(6);
  });

  it("Завеса 1 — Минуты (60с)", () => {
    expect(destabilizeRungSeconds(1)).toBe(60);
  });

  it("Завеса 2 — Часы (3600с)", () => {
    expect(destabilizeRungSeconds(2)).toBe(3600);
  });

  it("Завеса 3 — Дни (86400с)", () => {
    expect(destabilizeRungSeconds(3)).toBe(86400);
  });

  it("Завеса 4 — Месяцы (30×86400с)", () => {
    expect(destabilizeRungSeconds(4)).toBe(30 * 86400);
  });

  it("Завеса 5 и выше — Неограниченно (null)", () => {
    expect(destabilizeRungSeconds(5)).toBeNull();
    expect(destabilizeRungSeconds(100)).toBeNull();
  });

  it("дробный total округляется вниз до целой ступени", () => {
    expect(destabilizeRungSeconds(1.9)).toBe(60); // не дотянул до ступени 2
  });
});

describe("destabilizeDurationSeconds — полный срок", () => {
  it("базовая ступень (Раунды): бросок × 6с", () => {
    expect(destabilizeDurationSeconds(5, 0)).toBe(30);
  });

  it("минимум применяется к БРОСКУ, не к секундам (книга: «мин. 2»)", () => {
    expect(destabilizeDurationSeconds(1, 0)).toBe(2 * 6); // бросок 1 < мин.2 → 2
    expect(destabilizeDurationSeconds(0, 0)).toBe(2 * 6);
  });

  it("минимум параметризуется (Хост книга даёт «мин. 1»)", () => {
    expect(destabilizeDurationSeconds(1, 0, { minRoll: 1 })).toBe(1 * 6);
  });

  it("ступень истончения умножает секунды на единицу той ступени", () => {
    expect(destabilizeDurationSeconds(3, 2)).toBe(3 * 3600); // Часы
  });

  it("Неограниченно (Завеса ≥5) — null, срока нет вовсе", () => {
    expect(destabilizeDurationSeconds(10, 5)).toBeNull();
  });
});
