// test/rules/cast-out-of-death.test.mjs
//
// Cast Out of Death / Изгнанный из Смерти (wdbc-1rno, Нургл): дедлайн
// регенерации Ран к −7, тикает по worldTime/«Календарю» (тот же такт, что
// rules/fleshmetal-regen.mjs).

import { describe, it, expect } from "vitest";
import { scheduleCastOutOfDeathRegen, totalWoundsLevel, planCastOutOfDeathRegen, REGEN_FLOOR }
  from "../../module/rules/cast-out-of-death.mjs";

describe("scheduleCastOutOfDeathRegen", () => {
  it("дедлайн — ровно 7 часов (25200с) от переданного момента", () => {
    expect(scheduleCastOutOfDeathRegen(1000)).toBe(1000 + 7 * 3600);
  });
});

describe("totalWoundsLevel", () => {
  it("положительные Раны — как есть", () => {
    expect(totalWoundsLevel({ wounds: { value: 5, critical: 0 } })).toBe(5);
  });
  it("Критические (Раны в минусе) — отрицательным числом", () => {
    expect(totalWoundsLevel({ wounds: { value: 0, critical: 5 } })).toBe(-5);
  });
  it("нет данных — 0", () => {
    expect(totalWoundsLevel({})).toBe(0);
    expect(totalWoundsLevel(null)).toBe(0);
  });
});

describe("planCastOutOfDeathRegen", () => {
  it("без дедлайна (null) — план не нужен", () => {
    expect(planCastOutOfDeathRegen({ wounds: { value: 0, critical: 20 } }, null, 5000)).toBeNull();
  });

  it("дедлайн ещё не наступил — план не нужен", () => {
    const system = { wounds: { value: 0, critical: 20 } };
    expect(planCastOutOfDeathRegen(system, 10000, 9999)).toBeNull();
  });

  it("дедлайн наступил, Раны ниже −7 — поднимает ровно до −7 (value:0, critical:7)", () => {
    const system = { wounds: { value: 0, critical: 20 } }; // «−20»
    const plan = planCastOutOfDeathRegen(system, 10000, 10000);
    expect(plan.update).toEqual({ "system.wounds.value": 0, "system.wounds.critical": -REGEN_FLOOR });
  });

  it("дедлайн наступил, но Раны и так не ниже −7 — update пуст (гасить дедлайн — забота вызывающей стороны)", () => {
    const system = { wounds: { value: 0, critical: 3 } }; // «−3», выше пола
    const plan = planCastOutOfDeathRegen(system, 10000, 10000);
    expect(plan.update).toEqual({});
  });

  it("дедлайн наступил, Раны положительные (персонаж уже подлечен иначе) — update пуст", () => {
    const system = { wounds: { value: 5, critical: 0 } };
    const plan = planCastOutOfDeathRegen(system, 10000, 10000);
    expect(plan.update).toEqual({});
  });

  it("дедлайн наступил точно в момент тика (>=, не строго >) — срабатывает", () => {
    const system = { wounds: { value: 0, critical: 20 } };
    expect(planCastOutOfDeathRegen(system, 10000, 10000)).not.toBeNull();
    expect(planCastOutOfDeathRegen(system, 10000, 10001)).not.toBeNull();
  });
});
