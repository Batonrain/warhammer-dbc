// test/rules/equip-shop.test.mjs
//
// Очки Снаряжения (стр. 24) — таблица трат и математика пула. Сам расход
// (Обозреватель компендиумов, создание предметов) не тестируется здесь —
// живёт в character-wizard.mjs и требует Foundry.

import { describe, it, expect } from "vitest";
import { EQUIP_SHOP_ROWS, EQUIP_SHOP_ROW_BY_KEY, equipPointsTotal, equipPointsLeft,
         canAffordRow, startingAmmoQuantity, SACRIFICE_MOD_COUNT, SACRIFICE_MOD_MAX_AVAILABILITY }
  from "../../module/rules/equip-shop.mjs";

describe("Очки Снаряжения: таблица трат", () => {
  it("12 строк книги, все с уникальным ключом", () => {
    expect(EQUIP_SHOP_ROWS).toHaveLength(12);
    const keys = new Set(EQUIP_SHOP_ROWS.map(r => r.key));
    expect(keys.size).toBe(12);
  });

  it("цены совпадают с книгой (1/1/1/1/2/5 для покупок, 1/1/1 для качества, 1/2/4 для особого оружия)", () => {
    const cost = k => EQUIP_SHOP_ROW_BY_KEY[k].cost;
    expect(cost("r-1")).toBe(1);
    expect(cost("r0")).toBe(1);
    expect(cost("r1")).toBe(1);
    expect(cost("r2")).toBe(1);
    expect(cost("r3")).toBe(2);
    expect(cost("r4")).toBe(5);
    expect(cost("q3x1")).toBe(1);
    expect(cost("q1x2")).toBe(1);
    expect(cost("q1x1hi")).toBe(1);
    expect(cost("rune")).toBe(1);
    expect(cost("legacy")).toBe(2);
    expect(cost("daemonic")).toBe(4);
  });

  it("количество и Редкость покупных строк совпадают с книгой", () => {
    expect(EQUIP_SHOP_ROW_BY_KEY["r-1"]).toMatchObject({ kind: "buy", count: 50, maxAvailability: -1 });
    expect(EQUIP_SHOP_ROW_BY_KEY.r0).toMatchObject({ kind: "buy", count: 10, maxAvailability: 0 });
    expect(EQUIP_SHOP_ROW_BY_KEY.r1).toMatchObject({ kind: "buy", count: 3, maxAvailability: 1 });
    expect(EQUIP_SHOP_ROW_BY_KEY.r2).toMatchObject({ kind: "buy", count: 1, maxAvailability: 2 });
    expect(EQUIP_SHOP_ROW_BY_KEY.r3).toMatchObject({ kind: "buy", count: 1, maxAvailability: 3 });
    expect(EQUIP_SHOP_ROW_BY_KEY.r4).toMatchObject({ kind: "buy", count: 1, maxAvailability: 4 });
  });

  it("диапазон «Редкость 2-4» задан min и max, а не только max", () => {
    const row = EQUIP_SHOP_ROW_BY_KEY.q1x1hi;
    expect(row.minAvailability).toBe(2);
    expect(row.maxAvailability).toBe(4);
  });
});

describe("Очки Снаряжения: пул", () => {
  it("пул = Inf.b + бонус, отрицательные значения не уводят пул в минус", () => {
    expect(equipPointsTotal(3, 2)).toBe(5);
    expect(equipPointsTotal(3)).toBe(3);
    expect(equipPointsTotal(-1, -5)).toBe(0);
  });

  it("надбавок может быть несколько: Inf.b + бонус ГМа + «+2 очка» из текста Расы (wdbc-yobj)", () => {
    expect(equipPointsTotal(3, 1, 2)).toBe(6);
    expect(equipPointsTotal(3, 0, 2)).toBe(5);
    expect(equipPointsTotal(3, 1, 0)).toBe(4);
    expect(equipPointsTotal(3, 1, -2)).toBe(4); // отрицательная надбавка — опечатка, не штраф
  });

  it("остаток не уходит в минус даже если потрачено больше пула", () => {
    expect(equipPointsLeft(5, 2)).toBe(3);
    expect(equipPointsLeft(5, 5)).toBe(0);
    expect(equipPointsLeft(5, 9)).toBe(0);
  });

  it("canAffordRow — по цене строки и остатку", () => {
    const row = EQUIP_SHOP_ROW_BY_KEY.r3; // cost:2
    expect(canAffordRow(row, 2)).toBe(true);
    expect(canAffordRow(row, 1)).toBe(false);
    expect(canAffordRow(null, 5)).toBe(false);
  });
});

describe("Боеприпасы после завершения выбора снаряжения", () => {
  it("4 магазина или 20 — что больше", () => {
    expect(startingAmmoQuantity(10)).toBe(40);   // 4×10=40 > 20
    expect(startingAmmoQuantity(3)).toBe(20);    // 4×3=12 < 20
    expect(startingAmmoQuantity(5)).toBe(20);    // 4×5=20 == 20
  });

  it("оружие без магазина (0/не задано) — минимум 20", () => {
    expect(startingAmmoQuantity(0)).toBe(20);
    expect(startingAmmoQuantity(undefined)).toBe(20);
    expect(startingAmmoQuantity(null)).toBe(20);
  });
});

describe("Пожертвовать снаряжением за модификации", () => {
  it("3 модификации Редкостью не более 2 — константы книги", () => {
    expect(SACRIFICE_MOD_COUNT).toBe(3);
    expect(SACRIFICE_MOD_MAX_AVAILABILITY).toBe(2);
  });
});
