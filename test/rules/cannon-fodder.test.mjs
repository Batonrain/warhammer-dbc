// test/rules/cannon-fodder.test.mjs
//
// Cannon Fodder / Пушечное Мясо (Sahara 3-cross-actor, решение владельца
// 24.10.2026): «Миньон теряет 20 Лояльности» — Талант берётся отдельно на
// каждого Миньона; выбор — поле system.targetMinion копии Таланта, −20 только
// этому Миньону (rules/minion-build.mjs::minionLoyalty).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  minionLoyalty, cannonFodderPenalty, minionMatchesTarget, CANNON_FODDER_PENALTY
} from "../../module/rules/minion-build.mjs";

const master = (items = [], { fel = 42, wp = 35 } = {}) => ({
  system: { characteristics: { fel: { total: fel }, wp: { total: wp }, per: { total: 31 }, int: { total: 50 }, inf: { total: 60 } } },
  items
});
const fodder = target => ({
  id: `cf-${target}`, type: "talent", name: "Cannon Fodder / Пушечное Мясо", system: { targetMinion: target }
});
const slot = id => ({ uuid: `Actor.m-${id}`, slotTalentId: id });

describe("Cannon Fodder: поиск цели", () => {
  it("совпадение по uuid Миньона или по слоту, купившему его", () => {
    expect(minionMatchesTarget("Actor.m1", { uuid: "Actor.m1", slotTalentId: "" })).toBe(true);
    expect(minionMatchesTarget("slot:s1", { uuid: "Actor.zz", slotTalentId: "s1" })).toBe(true);
    expect(minionMatchesTarget("slot:s1", { uuid: "Actor.zz", slotTalentId: "s2" })).toBe(false);
    expect(minionMatchesTarget("", slot("s1"))).toBe(false);
    expect(minionMatchesTarget("slot:s1", null)).toBe(false);
  });
});

describe("Cannon Fodder: −20 Лояльности только выбранному Миньону", () => {
  it("штраф 20 — цель Таланта; другой Миньон хозяина не затронут", () => {
    const m = master([fodder("slot:s1")]);
    expect(CANNON_FODDER_PENALTY).toBe(20);
    expect(minionLoyalty(m, "human", slot("s1"))).toBe(42 - 20);
    expect(minionLoyalty(m, "human", slot("s2"))).toBe(42);
  });

  it("без указания Миньона (старые вызовы) Лояльность не меняется", () => {
    expect(minionLoyalty(master([fodder("slot:s1")]), "human")).toBe(42);
  });

  it("копии Таланта на одного и того же Миньона штраф не наращивают", () => {
    const m = master([fodder("slot:s1"), fodder("slot:s1")]);
    expect(cannonFodderPenalty(m, slot("s1"))).toBe(20);
    expect(minionLoyalty(m, "human", slot("s1"))).toBe(22);
  });

  it("Талант без выбранного Миньона никого не наказывает", () => {
    const m = master([fodder("")]);
    expect(minionLoyalty(m, "human", slot("s1"))).toBe(42);
  });

  it("Лояльность не уходит ниже нуля", () => {
    const m = master([fodder("slot:s1")], { fel: 12 });
    expect(minionLoyalty(m, "human", slot("s1"))).toBe(0);
  });

  it("работает вместе с прочими бонусами хозяина (Обожаемый Лидер +10)", () => {
    const leader = { id: "bl", type: "talent", name: "Beloved Leader", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "minion.core.belovedLeader", label: "" }] }] } } };
    const m = master([fodder("slot:s1"), leader]);
    expect(minionLoyalty(m, "human", slot("s1"))).toBe(42 + 10 - 20);
  });

  it("по uuid живого Миньона", () => {
    const m = master([fodder("Actor.m1")]);
    expect(minionLoyalty(m, "human", { uuid: "Actor.m1", slotTalentId: "" })).toBe(22);
  });
});
