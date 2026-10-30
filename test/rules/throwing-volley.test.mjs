// test/rules/throwing-volley.test.mjs
// 3-8318, Volley Throw / Залповый Бросок: «может использовать метательные ножи, флешеты и сходное по размеру метательное
// оружие в режиме длинной очереди с модификатором +0 вместо обычного −10 и RoF от 2 до 4 по выбору. Эта атака не
// получает бонусы от Прицеливания».
import { describe, it, expect } from "vitest";
import { volleyThrowApplies, volleyRof, VOLLEY_ROF_MIN, VOLLEY_ROF_MAX, VOLLEY_THROW_CAPABILITY }
  from "../../module/rules/throwing-talents.mjs";

const TALENT = { type: "talent", name: "Volley Throw / Залповый Бросок", system: {} };
const withTalent = { items: [TALENT] };
const knife = { weaponClass: "thrown", weaponType: "lowtech", weight: 0.2, rof_single: 1 };

describe("volleyThrowApplies", () => {
  it("метательный нож у носителя Таланта — да", () => {
    expect(volleyThrowApplies(withTalent, knife)).toBe(true);
  });
  it("без Таланта — нет", () => {
    expect(volleyThrowApplies({ items: [] }, knife)).toBe(false);
  });
  it("Талант опознаётся по ключу Возможности при испорченном имени", () => {
    const byKey = { type: "talent", name: "ИСПОРЧЕНО", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: VOLLEY_THROW_CAPABILITY, label: "" }] }] } } };
    expect(volleyThrowApplies({ type: "character", items: [byKey] }, knife)).toBe(true);
  });
  it("не метательное (стрелковое, рукопашное) оружие — нет", () => {
    expect(volleyThrowApplies(withTalent, { ...knife, weaponClass: "basic" })).toBe(false);
    expect(volleyThrowApplies(withTalent, { ...knife, weaponClass: "melee" })).toBe(false);
  });
  it("гранаты, бомбы, ракеты и экзотика — нет", () => {
    for (const weaponType of ["grenade", "explosive", "rocket", "exotic"])
      expect(volleyThrowApplies(withTalent, { ...knife, weaponType })).toBe(false);
  });
  it("тяжёлое по размеру (дротик 0,8 кг, топор 0,5 кг) — нет; лёгкое до 0,3 кг — да", () => {
    expect(volleyThrowApplies(withTalent, { ...knife, weight: 0.8 })).toBe(false);
    expect(volleyThrowApplies(withTalent, { ...knife, weight: 0.5 })).toBe(false);
    expect(volleyThrowApplies(withTalent, { ...knife, weight: 0.3 })).toBe(true);
  });
  it("вес не заполнен (0) — считаем лёгким (флешеты)", () => {
    expect(volleyThrowApplies(withTalent, { ...knife, weight: 0 })).toBe(true);
  });
  it("оружие без одиночного броска не бросают — нет", () => {
    expect(volleyThrowApplies(withTalent, { ...knife, rof_single: 0 })).toBe(false);
  });
});

describe("volleyRof — выбор RoF 2..4", () => {
  it("границы", () => {
    expect([VOLLEY_ROF_MIN, VOLLEY_ROF_MAX]).toEqual([2, 4]);
  });
  it("зажимается в диапазон", () => {
    expect(volleyRof(1)).toBe(2);
    expect(volleyRof(3)).toBe(3);
    expect(volleyRof(9)).toBe(4);
    expect(volleyRof("abc")).toBe(4);   // пустой ввод — потолок, как у Быстрого Курка
    expect(volleyRof(0)).toBe(4);
  });
});
