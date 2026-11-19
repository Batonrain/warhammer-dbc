// test/rules/minion-loyalty.test.mjs
//
// Тест Лояльности Миньона (корбук стр. 113): порог, переброс провала
// Монозависимого, повод Обожания Толпы и последствия. Плюс +20 Лояльности
// от Гранд Стратега и Ауры Могущества (Книга Аэльдари) в minionLoyalty.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  loyaltyThreshold, resolveLoyaltyRolls, loyaltyConsequence, loyaltyReasonOptions,
  hasMonodevotant, adoringCrowdsEligible, LOYALTY_COMBAT_FAIL_TEXT
} from "../../module/rules/minion-loyalty.mjs";
import { minionLoyalty } from "../../module/rules/minion-build.mjs";

const named = (type, name) => ({ id: `${type}-${name}`, type, name, system: {} });
const minion = ({ loyalty = 40, group = "human", items = [] } = {}) =>
  ({ system: { loyalty: { value: loyalty, max: loyalty }, minionType: group }, items, flags: {} });
const master = (items = []) => ({
  system: { characteristics: { fel: { total: 40 }, wp: { total: 35 }, per: { total: 31 }, int: { total: 50 }, inf: { total: 60 } } },
  items
});

describe("Порог теста Лояльности", () => {
  it("равен текущей Лояльности, а не максимуму, плюс модификатор ГМа", () => {
    const m = minion({ loyalty: 40 });
    m.system.loyalty.value = 25;
    expect(loyaltyThreshold(m)).toBe(25);
    expect(loyaltyThreshold(m, -10)).toBe(15);
    expect(loyaltyThreshold(m, 20)).toBe(45);
  });
});

describe("Монозависимый перебрасывает неудачный тест", () => {
  it("успех с первого броска — второй не нужен", () => {
    const r = resolveLoyaltyRolls([30, 99], 40, { rerollFailed: true });
    expect(r).toMatchObject({ rv: 30, success: true, rerolled: false, usedRolls: 1 });
  });

  it("провал переброшен — берётся второй бросок, даже если он хуже", () => {
    expect(resolveLoyaltyRolls([55, 12], 40, { rerollFailed: true }))
      .toMatchObject({ rv: 12, success: true, rerolled: true, first: 55 });
    expect(resolveLoyaltyRolls([45, 90], 40, { rerollFailed: true }))
      .toMatchObject({ rv: 90, success: false, rerolled: true });
  });

  it("без Черты провал остаётся провалом", () => {
    expect(resolveLoyaltyRolls([55, 12], 40)).toMatchObject({ rv: 55, success: false, rerolled: false });
  });

  it("Черту опознаёт по имени", () => {
    expect(hasMonodevotant(minion({ items: [named("trait", "Monodevotant / Монозависимый")] }))).toBe(true);
    expect(hasMonodevotant(minion())).toBe(false);
  });
});

describe("Последствия", () => {
  it("провал приказа в бою — ГМ берёт Миньона на себя; вне боя — нет", () => {
    expect(loyaltyConsequence("risk", false, { inCombat: true }).gmControl).toBe(true);
    expect(loyaltyConsequence("risk", false, { inCombat: false }).gmControl).toBe(false);
    expect(loyaltyConsequence("risk", true, { inCombat: true }).gmControl).toBe(false);
    expect(LOYALTY_COMBAT_FAIL_TEXT).toMatch(/до конца боя/);
  });

  it("Обожание Толпы: успех — +1 Очко Бесчестия Хозяину, провал — ничего и без перехвата", () => {
    expect(loyaltyConsequence("adoringCrowds", true, { inCombat: true }))
      .toMatchObject({ restoreMasterInfamy: 1, gmControl: false });
    expect(loyaltyConsequence("adoringCrowds", false, { inCombat: true }))
      .toMatchObject({ restoreMasterInfamy: 0, gmControl: false });
  });

  it("незнакомый повод считается «другим»", () => {
    expect(loyaltyConsequence("???", false, { inCombat: true }).gmControl).toBe(true);
  });
});

describe("Повод «Обожание Толпы» в окне", () => {
  const noteMaster = master([named("trait", "Adoring Crowds / Обожание Толпы")]);

  it("есть у Миньона-Человека Хозяина с Чертой", () => {
    expect(adoringCrowdsEligible(noteMaster, minion({ group: "human" }))).toBe(true);
    expect(loyaltyReasonOptions(noteMaster, minion()).map(r => r.key)).toContain("adoringCrowds");
  });

  it("нет у зверя, демона и у Хозяина без Черты", () => {
    expect(adoringCrowdsEligible(noteMaster, minion({ group: "beast" }))).toBe(false);
    expect(adoringCrowdsEligible(master(), minion())).toBe(false);
    expect(loyaltyReasonOptions(master(), minion()).map(r => r.key))
      .toEqual(["risk", "character", "mission", "other"]);
  });
});

describe("Книга Аэльдари: +20 Лояльности", () => {
  it("Гранд Стратег — всем Миньонам", () => {
    const m = master([named("trait", "Grand-Strategist / Гранд-Стратег")]);
    expect(minionLoyalty(m, "human")).toBe(60);
    expect(minionLoyalty(m, "daemon")).toBe(55);
  });

  it("Аура Могущества — только людям", () => {
    const m = master([named("talent", "The Aura of Power / Аура Могущества")]);
    expect(minionLoyalty(m, "human")).toBe(60);
    expect(minionLoyalty(m, "beast")).toBe(31);
  });

  it("Голем Рубрики не меняется ничем", () => {
    const m = master([named("trait", "Grand-Strategist / Гранд-Стратег")]);
    expect(minionLoyalty(m, "daemon", { golem: true })).toBe(30);
  });
});
