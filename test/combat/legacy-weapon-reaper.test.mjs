// test/combat/legacy-weapon-reaper.test.mjs
//
// Жнец/merciless 5-6, Оружие Наследия (wdbc-1rno.35, стр. 428): «После
// получения непоглощённого урона от этого оружия цель должна пройти тест на
// Т−2×Inf.b, или получить Кровотечение.»

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { reaperLegacyButtonHtml, rollLegacyReaperTest } from "../../module/combat/legacy-weapon-reaper.mjs";

beforeEach(() => resetCaptured());

function reaperWeapon(owner, overrides = {}) {
  return {
    id: "w1", uuid: "Item.w1", name: "Серп Экзекутора", type: "weapon", parent: owner,
    system: { weaponClass: "melee", damage: "1d10+3", legacy: { active: true, mutations: [{ name: "Жнец" }] }, ...overrides }
  };
}

function ownerActor(infBonus = 3) {
  return { name: "Экзекутор", system: { characteristics: { inf: { bonus: infBonus } } } };
}

function defenderActor(tTotal = 40, overrides = {}) {
  const actor = {
    name: "Цель", uuid: "Actor.defender1", items: [],
    system: { characteristics: { t: { total: tTotal } }, conditions: {}, ...overrides },
    lastUpdate: null,
    update: async (fields) => { actor.lastUpdate = fields; return fields; }
  };
  return actor;
}

describe("reaperLegacyButtonHtml", () => {
  it("с Мутацией и defenderUuid — кнопка есть", () => {
    const w = reaperWeapon(ownerActor());
    const html = reaperLegacyButtonHtml(w, "Actor.defender1");
    expect(html).toContain("wh-legacy-reaper-btn");
    expect(html).toContain('data-item-uuid="Item.w1"');
    expect(html).toContain('data-defender-uuid="Actor.defender1"');
  });

  it("без Мутации — пусто", () => {
    const w = reaperWeapon(ownerActor());
    w.system.legacy.mutations = [];
    expect(reaperLegacyButtonHtml(w, "Actor.defender1")).toBe("");
  });

  it("нет defenderUuid — пусто", () => {
    const w = reaperWeapon(ownerActor());
    expect(reaperLegacyButtonHtml(w, "")).toBe("");
  });
});

describe("rollLegacyReaperTest", () => {
  it("тест провален — Кровотечение наложено", async () => {
    const owner = ownerActor(3);
    const weapon = reaperWeapon(owner);
    const defender = defenderActor(40); // порог 40 − 2×3 = 34
    captured.dice = [50]; // 1d100=50 > 34 — провал
    await rollLegacyReaperTest(weapon, defender);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Кровотечение");
    expect(defender.lastUpdate?.["system.conditions.bleeding"]).toBe(true);
  });

  it("тест пройден — без Кровотечения", async () => {
    const owner = ownerActor(3);
    const weapon = reaperWeapon(owner);
    const defender = defenderActor(40); // порог 34
    captured.dice = [10]; // 1d100=10 ≤ 34 — успех
    await rollLegacyReaperTest(weapon, defender);
    expect(captured.chat.at(-1).content).toContain("Устоял");
  });

  it("нет владельца оружия (item.parent) — предупреждает, не падает", async () => {
    const weapon = reaperWeapon(null);
    await rollLegacyReaperTest(weapon, defenderActor());
    expect(captured.chat.length).toBe(0);
  });

  it("нет защищавшегося — предупреждает, не падает", async () => {
    const weapon = reaperWeapon(ownerActor());
    await rollLegacyReaperTest(weapon, null);
    expect(captured.chat.length).toBe(0);
  });
});
