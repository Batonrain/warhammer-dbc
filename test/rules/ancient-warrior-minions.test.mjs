// test/rules/ancient-warrior-minions.test.mjs
//
// Ancient Warrior / Древний Воин (Sahara peer-ancient-warrior-…, часть «в»,
// решение 24.10.2026): «+10 к Лояльности Миньонов-Космодесантников» — поле
// «Астартес» на Миньоне (data/actor/minion.mjs::isAstartes) и ветка в
// minionLoyalty. «−1 Редкость» и «+10 к соц. взаимодействиям с Космодесантниками
// Хаоса» остаются за тестом «Реквизиция» — здесь их нет.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { minionLoyalty, ANCIENT_WARRIOR_LOYALTY_BONUS } from "../../module/rules/minion-build.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const capTalent = capabilityKey => ({
  id: `t-${capabilityKey}`, type: "talent", name: capabilityKey, system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey, label: "" }] }] } }
});
const master = (items = []) => ({
  system: { characteristics: { fel: { total: 40 }, wp: { total: 35 }, per: { total: 31 }, int: { total: 50 }, inf: { total: 60 } } },
  items
});

describe("Ancient Warrior: +10 Лояльности Миньонам-Астартес", () => {
  it("число из книги", () => expect(ANCIENT_WARRIOR_LOYALTY_BONUS).toBe(10));

  it("Миньон-Астартес Хозяина с Талантом получает +10", () => {
    const m = master([capTalent("arsenal.core.ancientWarrior")]);
    expect(minionLoyalty(m, "human", { astartes: true })).toBe(50);
  });

  it("обычный Миньон того же Хозяина — без бонуса", () => {
    const m = master([capTalent("arsenal.core.ancientWarrior")]);
    expect(minionLoyalty(m, "human", { astartes: false })).toBe(40);
    expect(minionLoyalty(m, "human")).toBe(40);
  });

  it("Миньон-Астартес Хозяина без Таланта — без бонуса", () => {
    expect(minionLoyalty(master(), "human", { astartes: true })).toBe(40);
  });

  it("складывается с Обожаемым Лидером (+10) и Пушечным Мясом (−20)", () => {
    const fodder = { id: "cf", type: "talent", name: "Cannon Fodder", system: { targetMinion: "slot:s1" } };
    const m = master([capTalent("arsenal.core.ancientWarrior"), capTalent("minion.core.belovedLeader"), fodder]);
    expect(minionLoyalty(m, "human", { astartes: true, slotTalentId: "s1" })).toBe(40 + 10 + 10 - 20);
  });
});

describe("Миньон: поле «Астартес»", () => {
  it("в схеме по умолчанию выключено", () => {
    const sys = new ACTOR_DATA_MODELS.minion({}).toObject();
    expect(sys.isAstartes).toBe(false);
  });
  it("сохраняется как булево", () => {
    expect(new ACTOR_DATA_MODELS.minion({ isAstartes: true }).toObject().isAstartes).toBe(true);
  });
});
