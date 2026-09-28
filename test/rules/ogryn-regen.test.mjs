// test/rules/ogryn-regen.test.mjs
//
// «Физиология Громилы» (Огрин, корбук, глава I): «Если он легко ранен, он
// пассивно восстанавливает 1 Рану в минуту, если тяжело ранен – 1 Рану в 10
// минут, а если критически ранен – 1 Рану в час (Талант Hardy не влияет)».
// Чистая арифметика — rules/ogryn-regen.mjs; часы и бой — combat/ogryn-regen.mjs.

import { describe, it, expect } from "vitest";
import {
  OGRYN_REGEN_PERIOD, ogrynRegenStep, SECONDS_PER_COMBAT_ROUND
} from "../../module/rules/ogryn-regen.mjs";

// T.b 10 (T 45 + Сверхъестественная Стойкость 6): лёгкое — потеряно ≤ 20 Ран.
const sys = ({ value, max = 40, critical = 0, tb = 10 }) => ({
  wounds: { value, max, critical }, characteristics: { t: { bonus: tb } }
});

describe("периоды по книге", () => {
  it("лёгкое — минута, тяжёлое — 10 минут, критическое — час", () => {
    expect(OGRYN_REGEN_PERIOD).toEqual({ light: 60, heavy: 600, critical: 3600 });
  });
  it("боевой Раунд — 5 секунд (корбук, «Ход и Инициатива»)", () => {
    expect(SECONDS_PER_COMBAT_ROUND).toBe(5);
  });
});

describe("ogrynRegenStep", () => {
  it("легко раненый: 3 минуты — 3 Раны", () => {
    const r = ogrynRegenStep(sys({ value: 30 }), 0, 180);
    expect(r.healed).toBe(3);
    expect(r.wounds).toEqual({ value: 33, critical: 0 });
    expect(r.bank).toBe(0);
  });

  it("неполный период копится в банке, а не пропадает", () => {
    const a = ogrynRegenStep(sys({ value: 30 }), 0, 40);
    expect(a.healed).toBe(0);
    expect(a.bank).toBe(40);
    const b = ogrynRegenStep(sys({ value: 30 }), a.bank, 25);
    expect(b.healed).toBe(1);
    expect(b.bank).toBe(5);
  });

  it("тяжело раненый лечится по 10 минут, пока не станет легко раненым — дальше по минуте", () => {
    // Потеряно 22 (> 2×T.b = 20) — тяжёлое. Первая Рана через 600 с,
    // вторая тоже (потеряно 21 — всё ещё тяжёлое), дальше — лёгкое.
    const r = ogrynRegenStep(sys({ value: 18 }), 0, 1200 + 120);
    expect(r.healed).toBe(4);
    expect(r.wounds.value).toBe(22);
  });

  it("критически раненый — сперва гасит Критические, по часу за штуку", () => {
    const r = ogrynRegenStep(sys({ value: 0, critical: 2 }), 0, 3600);
    expect(r.healed).toBe(1);
    expect(r.wounds).toEqual({ value: 0, critical: 1 });
  });

  it("выше максимума не лечит, банк при полном здоровье сбрасывается", () => {
    const r = ogrynRegenStep(sys({ value: 39 }), 0, 6000);
    expect(r.healed).toBe(1);
    expect(r.wounds.value).toBe(40);
    expect(r.bank).toBe(0);
  });

  it("здоровому нечего лечить — ноль и пустой банк", () => {
    expect(ogrynRegenStep(sys({ value: 40 }), 500, 600)).toMatchObject({ healed: 0, bank: 0 });
  });

  it("Hardy не влияет: уровень считается по настоящим Ранам, а не «всегда лёгкое»", () => {
    // Тот же тяжело раненый — никакой поправки на Талант функция не знает.
    const r = ogrynRegenStep(sys({ value: 10 }), 0, 60);
    expect(r.healed).toBe(0);
  });

  it("мусор на входе не ломает расчёт", () => {
    expect(ogrynRegenStep({}, NaN, -5)).toMatchObject({ healed: 0, bank: 0 });
  });
});
