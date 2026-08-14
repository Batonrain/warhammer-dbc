import { describe, it, expect } from "vitest";
import {
  MINION_TYPES, MINION_TIERS, minionsOf, baseLoyaltyFor, loyaltyAfterChange, minionsContext
} from "../../module/apps/minions.mjs";

/** Подставные акторы: обычные литералы, никакого Foundry. */
const master = (over = {}) => ({
  id: "m1", uuid: "Actor.m1", name: "Хозяин", type: "character",
  system: { characteristics: { fel: { total: 42 }, per: { total: 31 }, int: { total: 25 }, wp: { total: 38 } } },
  ...over
});

const minion = ({ id = "s1", name = "Слуга", masterUuid = "Actor.m1", minionType = "human",
                  minionTier = "lesser", value = 0, max = 0, type = "character" } = {}) => ({
  id, uuid: `Actor.${id}`, name, type,
  system: { masterUuid, minionType, minionTier, loyalty: { value, max }, characteristics: {} }
});

describe("minionsOf", () => {
  it("находит акторов, чей Хозяин — этот", () => {
    const m = master();
    const mine = minion({ id: "a" });
    const other = minion({ id: "b", masterUuid: "Actor.zzz" });
    expect(minionsOf(m, [mine, other, m]).map(a => a.id)).toEqual(["a"]);
  });

  it("без uuid и без акторов — пусто", () => {
    expect(minionsOf(null, [minion()])).toEqual([]);
    expect(minionsOf(master(), [])).toEqual([]);
  });
});

describe("baseLoyaltyFor", () => {
  it("берёт ЗНАЧЕНИЕ своей характеристики Хозяина для каждой группы", () => {
    const m = master();
    expect(baseLoyaltyFor(m, "human")).toBe(42);   // F
    expect(baseLoyaltyFor(m, "beast")).toBe(31);   // P
    expect(baseLoyaltyFor(m, "machine")).toBe(25); // I
    expect(baseLoyaltyFor(m, "daemon")).toBe(38);  // W
  });

  it("без типа и без Хозяина — ноль", () => {
    expect(baseLoyaltyFor(master(), "")).toBe(0);
    expect(baseLoyaltyFor(master(), "unknown")).toBe(0);
    expect(baseLoyaltyFor(null, "human")).toBe(0);
  });

  it("у каждой группы книги есть своя характеристика Хозяина", () => {
    expect(Object.values(MINION_TYPES).every(d => !!d.masterChar)).toBe(true);
  });
});

describe("loyaltyAfterChange", () => {
  it("прибавляет и вычитает", () => {
    expect(loyaltyAfterChange(minion({ value: 10, max: 40 }), 5)).toBe(15);
    expect(loyaltyAfterChange(minion({ value: 10, max: 40 }), -4)).toBe(6);
  });

  it("ниже нуля не опускается", () => {
    expect(loyaltyAfterChange(minion({ value: 2, max: 40 }), -10)).toBe(0);
  });

  it("выше максимума не поднимается", () => {
    expect(loyaltyAfterChange(minion({ value: 38, max: 40 }), 10)).toBe(40);
  });

  // Нулевой максимум означает «Лояльность ещё не считали», а не потолок в ноль:
  // иначе прибавка миньону без синхронизации молча пропадала бы.
  it("нулевой максимум потолком не считается", () => {
    expect(loyaltyAfterChange(minion({ value: 0, max: 0 }), 7)).toBe(7);
  });
});

describe("minionsContext", () => {
  const m = master();
  const a = minion({ id: "a", name: "Борис", minionType: "beast", minionTier: "greater", value: 12, max: 31 });
  const b = minion({ id: "b", name: "Аня" });
  const stranger = minion({ id: "c", name: "Чужой", masterUuid: "Actor.zzz" });
  const world = [m, a, b, stranger];

  it("Хозяин видит своих миньонов по алфавиту, с подписями типа и уровня", () => {
    const ctx = minionsContext(m, world);
    expect(ctx.canHaveMinions).toBe(true);
    expect(ctx.myMinions.map(x => x.name)).toEqual(["Аня", "Борис"]);
    expect(ctx.myMinions[1]).toMatchObject({
      typeLabel: MINION_TYPES.beast.label, tierLabel: MINION_TIERS.greater,
      loyaltyValue: 12, loyaltyMax: 31
    });
  });

  it("неизвестный тип и уровень показываются прочерком, а не пустотой", () => {
    const ctx = minionsContext(m, [m, minion({ id: "x", minionType: "", minionTier: "" })]);
    expect(ctx.myMinions[0]).toMatchObject({ typeLabel: "—", tierLabel: "—" });
  });

  it("сам себе Хозяином не предлагается", () => {
    const ctx = minionsContext(m, world);
    expect(ctx.masterOptions.some(o => o.uuid === m.uuid)).toBe(false);
  });

  it("в Хозяева идут только подходящие типы акторов", () => {
    const ship = { id: "sh", uuid: "Actor.sh", name: "Корабль", type: "ship", system: {} };
    const prince = { id: "dp", uuid: "Actor.dp", name: "Принц", type: "demonPrince", system: {} };
    const ctx = minionsContext(a, [a, ship, prince, m]);
    expect(ctx.masterOptions.map(o => o.uuid)).toEqual(["Actor.dp", "Actor.m1"]);
  });

  it("выбранный Хозяин и текущие тип с уровнем помечены выбранными", () => {
    const ctx = minionsContext(a, world);
    expect(ctx.isMinionCapable).toBe(true);
    expect(ctx.masterOptions.find(o => o.selected)?.uuid).toBe("Actor.m1");
    expect(ctx.minionTypeOptions.find(o => o.selected)?.key).toBe("beast");
    expect(ctx.minionTierOptions.find(o => o.selected)?.key).toBe("greater");
  });

  // Принц Демонов Хозяином быть может, а чьим-то миньоном — нет: панель
  // «МИНЬОН» у него не показывается.
  it("Принц Демонов — только Хозяин, техника — ни то, ни другое", () => {
    const prince = { id: "dp", uuid: "Actor.dp", name: "Принц", type: "demonPrince", system: {} };
    const vehicle = { id: "v", uuid: "Actor.v", name: "Танк", type: "vehicle", system: {} };
    expect(minionsContext(prince, [prince])).toMatchObject({ isMinionCapable: false, canHaveMinions: true });
    expect(minionsContext(vehicle, [vehicle])).toMatchObject({ isMinionCapable: false, canHaveMinions: false });
  });
});
