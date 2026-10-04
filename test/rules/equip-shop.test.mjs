// test/rules/equip-shop.test.mjs
//
// Очки Снаряжения (стр. 24) — таблица трат и математика пула. Сам расход
// (Обозреватель компендиумов, создание предметов) не тестируется здесь —
// живёт в character-wizard.mjs и требует Foundry.

import { describe, it, expect } from "vitest";
import { EQUIP_SHOP_ROWS, EQUIP_SHOP_ROW_BY_KEY, equipPointsTotal, equipPointsLeft,
         canAffordRow, equipPointsInfBonus, EQUIP_ANY_PACK, EQUIP_SHOP_PACKS, EQUIP_POINTS_PENALTY_CAPABILITY, startingAmmoQuantity, SACRIFICE_MOD_COUNT, SACRIFICE_MOD_MAX_AVAILABILITY,
         sacrificeModPack, planStartingAmmo }
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

describe("«Растраты»: −1 Inf.b в расчёте стартового снаряжения (стр. 22)", () => {
  it("штраф снимает очко с Inf.b, не с итога", () => {
    expect(equipPointsInfBonus(4, 1)).toBe(3);
    // Надбавки Расы и ГМа считаются поверх уже сниженного Inf.b.
    expect(equipPointsTotal(equipPointsInfBonus(4, 1), 2, 1)).toBe(6);
  });
  it("Inf.b не уходит ниже нуля", () => {
    expect(equipPointsInfBonus(0, 1)).toBe(0);
    expect(equipPointsInfBonus(1, 5)).toBe(0);
  });
  it("без штрафа — как раньше", () => {
    expect(equipPointsInfBonus(3)).toBe(3);
    expect(equipPointsInfBonus(3, 0)).toBe(3);
  });
  it("отрицательный «штраф» в данных бонусом не становится", () => {
    expect(equipPointsInfBonus(3, -2)).toBe(3);
  });
  it("имя возможности — то, что несёт запись пака Растрат", () => {
    expect(EQUIP_POINTS_PENALTY_CAPABILITY).toBe("creation.equipPointsPenalty");
  });
});

describe("«Любой предмет снаряжения» (Богатство)", () => {
  it("совпадает по категориям с магазином Очков Снаряжения", () => {
    expect(EQUIP_ANY_PACK).toBe("physical");
    expect(EQUIP_SHOP_PACKS).toEqual(["weapons", "armor", "gear", "ammunition", "implants", "tools", "shields"]);
  });
});

describe("таблица Очков Снаряжения — построчно по книге (сверка 04.10.2026)", () => {
  // Дословно из корбука: [очки, ключ строки]. Ключи — внутренние, очки — книжные.
  const BOOK = [
    ["r-1", 1, "buy", 50, -1], ["r0", 1, "buy", 10, 0], ["r1", 1, "buy", 3, 1], ["r2", 1, "buy", 1, 2],
    ["r3", 2, "buy", 1, 3], ["r4", 5, "buy", 1, 4]
  ];
  for (const [key, cost, kind, count, maxAvailability] of BOOK) {
    it(`${key}: ${cost} очк. за ${count} предм. Редкостью до ${maxAvailability}`, () => {
      expect(EQUIP_SHOP_ROW_BY_KEY[key]).toMatchObject({ cost, kind, count, maxAvailability });
    });
  }

  it("Качество: 3 предмета на 1, предмет на 2 (оба Редкость ≤1), предмет Редкостью 2-4 на 1 — по 1 очку", () => {
    expect(EQUIP_SHOP_ROW_BY_KEY.q3x1).toMatchObject({ cost: 1, count: 3, steps: 1, maxAvailability: 1 });
    expect(EQUIP_SHOP_ROW_BY_KEY.q1x2).toMatchObject({ cost: 1, count: 1, steps: 2, maxAvailability: 1 });
    expect(EQUIP_SHOP_ROW_BY_KEY.q1x1hi).toMatchObject({ cost: 1, count: 1, steps: 1, minAvailability: 2, maxAvailability: 4 });
  });

  it("Рунический 1, Наследия 2, Демоническое 4 очка — оружие Редкостью не более 2", () => {
    expect(EQUIP_SHOP_ROW_BY_KEY.rune).toMatchObject({ cost: 1, maxAvailability: 2 });
    expect(EQUIP_SHOP_ROW_BY_KEY.legacy).toMatchObject({ cost: 2, maxAvailability: 2 });
    expect(EQUIP_SHOP_ROW_BY_KEY.daemonic).toMatchObject({ cost: 4, maxAvailability: 2 });
  });
});

describe("жертва: из какого компендиума модификации", () => {
  it("броня и оружие — свои", () => {
    expect(sacrificeModPack("armor")).toBe("armor-mods");
    expect(sacrificeModPack("weapon")).toBe("weapon-mods");
  });

  it("кибернетика и импланты — null: книга оставляет выбор игроку", () => {
    expect(sacrificeModPack("cybernetic")).toBeNull();
    expect(sacrificeModPack("implant")).toBeNull();
    expect(sacrificeModPack(undefined)).toBeNull();
  });
});

describe("стартовые боеприпасы — каждому оружию свой комплект (стр. 24)", () => {
  const lib = [
    { key: "las",  weaponTypes: ["las"] },
    { key: "lasX", weaponTypes: ["las"], damageMod: 2 },          // спецбоеприпас
    { key: "bolt", weaponTypes: ["bolt"] }
  ];

  it("магазин большой — 4 магазина, иначе 20", () => {
    expect(planStartingAmmo([{ weaponType: "bolt", magazineMax: 24 }], lib).get("bolt")).toBe(96);
    expect(planStartingAmmo([{ weaponType: "las", magazineMax: 3 }], lib).get("las")).toBe(20);
  });

  it("два оружия одного типа — одна стопка, комплекты складываются", () => {
    const plan = planStartingAmmo([
      { weaponType: "las", magazineMax: 3 }, { weaponType: "las", magazineMax: 3 }], lib);
    expect(plan.size).toBe(1);
    expect(plan.get("las")).toBe(40);
  });

  it("берётся стандартный боеприпас, а не спецбоеприпас с модификатором", () => {
    const plan = planStartingAmmo([{ weaponType: "las", magazineMax: 3 }], [lib[1], lib[0]]);
    expect([...plan.keys()]).toEqual(["las"]);
  });

  it("оружие без магазина и тип без боеприпаса — ничего", () => {
    expect(planStartingAmmo([{ weaponType: "las", magazineMax: 0 }], lib).size).toBe(0);
    expect(planStartingAmmo([{ weaponType: "plasma", magazineMax: 5 }], lib).size).toBe(0);
    expect(planStartingAmmo([], lib).size).toBe(0);
    expect(planStartingAmmo(undefined, undefined).size).toBe(0);
  });
});
