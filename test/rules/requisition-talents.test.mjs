// test/rules/requisition-talents.test.mjs
//
// Таланты теста «Реквизиция» (rules/requisition-talents.mjs, источник правил
// "requisitionTalents"): Чрезмерное Богатство, Повелитель Войны, Сеть Контактов,
// Дело Фактотума. Через настоящий конвейер resolveTest — как их видит окно броска.

import { describe, it, expect } from "vitest";
import { resolveTest, effectAppliesTo } from "../../module/rules/resolve-test.mjs";
import { requisitionTalentRules } from "../../module/rules/requisition-talents.mjs";
import { requisitionPlan } from "../../module/rules/requisition.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (...names) => ({ type: "character", system: {}, items: names.map(talent) });

const WEALTH = "Excessive Wealth / Чрезмерное Богатство";
const WAR = "Lord of War / Повелитель Войны";
const NETWORK = "Contact Network / Сеть Контактов";
const FACTOTUM = "The Factotum Case / Дело Фактотума";

const reqCtx = (extra = {}) => ({ kind: "skill", char: "inf", requisition: true, requisitionRarity: 0, requisitionQuantity: 1, ...extra });
const commerceCtx = { kind: "skill", skill: "commerce", char: "fel" };

const labels = list => list.map(m => m.label);

describe("область «requisition» в конвейере теста", () => {
  it("подходит только тесту с ctx.requisition", () => {
    expect(effectAppliesTo("requisition", { kind: "skill", char: "inf", requisition: true })).toBe(true);
    expect(effectAppliesTo("requisition", { kind: "skill", char: "inf" })).toBe(false);
    expect(effectAppliesTo("requisition", { kind: "skill", skill: "commerce" })).toBe(false);
  });
});

describe("Чрезмерное Богатство", () => {
  it("Реквизиция: галочка +10 (не авто)", () => {
    const r = resolveTest({ actor: actorWith(WEALTH), ...reqCtx() });
    const m = r.mods.find(x => x.ruleId === "requisition.excessiveWealth");
    expect(m).toMatchObject({ value: 10, askOnly: true });
    expect(m.label).toMatch(/демонстрация богатства/);
    expect(r.autoMods).toEqual([]);
  });
  it("Commerce: та же галочка +10", () => {
    const r = resolveTest({ actor: actorWith(WEALTH), ...commerceCtx });
    expect(r.mods.map(m => m.value)).toContain(10);
  });
  it("обычный тест Inf без реквизиции — ничего", () => {
    const r = resolveTest({ actor: actorWith(WEALTH), kind: "skill", char: "inf" });
    expect(r.mods.filter(m => m.ruleId === "requisition.excessiveWealth")).toEqual([]);
  });
  it("тест не-Commerce навыка — ничего", () => {
    const r = resolveTest({ actor: actorWith(WEALTH), kind: "skill", skill: "charm", char: "fel" });
    expect(r.mods.filter(m => m.ruleId === "requisition.excessiveWealth")).toEqual([]);
  });
  it("без Таланта — ничего", () => {
    expect(resolveTest({ actor: actorWith(), ...reqCtx() }).mods.filter(m => m.ruleId?.startsWith("requisition."))).toEqual([]);
  });
});

describe("Повелитель Войны: +20 на опт 1001+ при Редкости 0 и ниже", () => {
  const modsFor = ctx => resolveTest({ actor: actorWith(WAR), ...ctx });
  it("Реквизиция: автоматически при Редкости 0 и 1001 штуке", () => {
    const r = modsFor(reqCtx({ requisitionRarity: 0, requisitionQuantity: 1001 }));
    expect(r.autoMods.find(m => m.ruleId === "requisition.lordOfWar")?.value).toBe(20);
    expect(r.mods.filter(m => m.ruleId === "requisition.lordOfWar")).toEqual([]);
  });
  it("Редкость −3 и 5000 штук — тоже", () => {
    const r = modsFor(reqCtx({ requisitionRarity: -3, requisitionQuantity: 5000 }));
    expect(r.autoMods.some(m => m.ruleId === "requisition.lordOfWar")).toBe(true);
  });
  it("1000 штук — нет (опт начинается с 1001)", () => {
    const r = modsFor(reqCtx({ requisitionRarity: 0, requisitionQuantity: 1000 }));
    expect(r.autoMods.some(m => m.ruleId === "requisition.lordOfWar")).toBe(false);
  });
  it("Редкость 1 — нет", () => {
    const r = modsFor(reqCtx({ requisitionRarity: 1, requisitionQuantity: 2000 }));
    expect(r.autoMods.some(m => m.ruleId === "requisition.lordOfWar")).toBe(false);
  });
  it("Commerce: галочка +20 (предмета в тесте нет)", () => {
    const r = modsFor(commerceCtx);
    const m = r.mods.find(x => x.ruleId === "requisition.lordOfWar");
    expect(m).toMatchObject({ value: 20, askOnly: true });
  });
  it("без числа Редкости в контексте — не срабатывает (NaN не считается нулём)", () => {
    const r = resolveTest({ actor: actorWith(WAR), kind: "skill", char: "inf", requisition: true });
    expect(r.autoMods.some(m => m.ruleId === "requisition.lordOfWar")).toBe(false);
  });
  it("вместе с планом: экзотика R1 при Повелителе Войны становится R0 и открывает оптовый бонус", () => {
    const a = actorWith(WAR);
    const item = { type: "weapon", name: "Экзотика", system: { availability: 1, weaponType: "exotic" } };
    const plan = requisitionPlan(a, { item, quantity: 2000, quality: "common" });
    expect(plan.rarity).toBe(0);
    const r = resolveTest({ actor: a, kind: "skill", char: "inf", ...plan.rollContext });
    expect(r.autoMods.find(m => m.ruleId === "requisition.lordOfWar")?.value).toBe(20);
  });
});

describe("Сеть Контактов: F вместо Inf", () => {
  it("галочка с переключением «Бросок с:» на F", () => {
    const r = resolveTest({ actor: actorWith(NETWORK), ...reqCtx() });
    const m = r.mods.find(x => x.ruleId === "requisition.contactNetwork");
    expect(m).toMatchObject({ value: 0, setChar: "fel" });
  });
  it("на тесте Commerce её нет", () => {
    const r = resolveTest({ actor: actorWith(NETWORK), ...commerceCtx });
    expect(r.mods.some(x => x.ruleId === "requisition.contactNetwork")).toBe(false);
  });
});

describe("Дело Фактотума", () => {
  it("Реквизиция: галочка +10 «на обслуживание пустолёта»", () => {
    const r = resolveTest({ actor: actorWith(FACTOTUM), ...reqCtx() });
    const m = r.mods.find(x => x.ruleId === "requisition.factotumCase");
    expect(m).toMatchObject({ value: 10, askOnly: true });
    expect(m.label).toMatch(/пустолёта/);
  });
  it("на тесте Commerce её нет", () => {
    const r = resolveTest({ actor: actorWith(FACTOTUM), ...commerceCtx });
    expect(r.mods.some(x => x.ruleId === "requisition.factotumCase")).toBe(false);
  });
});

describe("requisitionTalentRules напрямую", () => {
  it("на постороннем тесте пусто и не падает без контекста", () => {
    expect(requisitionTalentRules(actorWith(WEALTH, WAR, NETWORK, FACTOTUM), { kind: "skill", skill: "charm" })).toEqual([]);
    expect(requisitionTalentRules(actorWith(WEALTH), undefined)).toEqual([]);
    expect(requisitionTalentRules(null, { requisition: true })).toEqual([]);
  });
  it("все четыре Таланта на Реквизиции дают правила с разными id", () => {
    const rules = requisitionTalentRules(actorWith(WEALTH, WAR, NETWORK, FACTOTUM),
      reqCtx({ requisitionRarity: 0, requisitionQuantity: 1001 }));
    expect(labels(rules).length).toBe(4);
    expect(new Set(rules.map(r => r.id)).size).toBe(4);
  });
});
