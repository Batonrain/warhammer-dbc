// test/combat/attack-limit.test.mjs
//
// Стр. 12, wdbc-x1nz.2.30: «Персонаж может совершать только одну Атаку в
// свой Ход». Determination To Fight/Решительность Сражаться (стр. 62) при
// отрицательных Ранах поднимает лимит до двух.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { attackActionLimit, canTakeAttackAction, takeAttackAction } from "../../module/combat/attack-limit.mjs";

function actorFor({ type = "character", wounds = { tier: "healthy" }, items = [], ...overrides } = {}) {
  const store = {};
  const doc = { type, items, system: { wounds, ...overrides } };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return doc;
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("attackActionLimit", () => {
  it("базовый лимит — 1", () => {
    expect(attackActionLimit(actorFor())).toBe(1);
  });

  it("Determination To Fight без отрицательных Ран — лимит остаётся 1", () => {
    const actor = actorFor({ items: [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }] });
    expect(attackActionLimit(actor)).toBe(1);
  });

  it("Determination To Fight + отрицательные Раны — лимит 2", () => {
    const actor = actorFor({
      wounds: { tier: "dying" },
      items: [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }]
    });
    expect(attackActionLimit(actor)).toBe(2);
  });

  it("отрицательные Раны без Таланта — лимит остаётся 1", () => {
    expect(attackActionLimit(actorFor({ wounds: { tier: "dying" } }))).toBe(1);
  });

  it("ГМ-надбавка system.attackLimitBonus складывается с книжным лимитом (wdbc-6rj)", () => {
    expect(attackActionLimit(actorFor({ attackLimitBonus: 2 }))).toBe(3);
  });

  it("ГМ-надбавка складывается и с Решительностью Сражаться", () => {
    const actor = actorFor({
      wounds: { tier: "dying" }, attackLimitBonus: 1,
      items: [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }]
    });
    expect(attackActionLimit(actor)).toBe(3);
  });
});

describe("canTakeAttackAction / takeAttackAction", () => {
  it("вне Encounter лимит не считается — всегда можно", async () => {
    const actor = actorFor();
    expect(canTakeAttackAction(actor)).toBe(true);
    await takeAttackAction(actor);
    await takeAttackAction(actor);
    expect(canTakeAttackAction(actor)).toBe(true);
  });

  it("в бою — первая Атака разрешена, вторая (без расширения лимита) — нет", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor();
    expect(canTakeAttackAction(actor)).toBe(true);
    await takeAttackAction(actor);
    expect(canTakeAttackAction(actor)).toBe(false);
  });

  it("Determination To Fight при отрицательных Ранах — вторая Атака разрешена, третья — нет", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({
      wounds: { tier: "dying" },
      items: [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }]
    });
    await takeAttackAction(actor);
    expect(canTakeAttackAction(actor)).toBe(true);
    await takeAttackAction(actor);
    expect(canTakeAttackAction(actor)).toBe(false);
  });

  it("Орда/техника (нет экономики действий) — лимит не считается", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ type: "vehicle" });
    await takeAttackAction(actor);
    await takeAttackAction(actor);
    expect(canTakeAttackAction(actor)).toBe(true);
  });
});

describe("Многорукий: +1 Атака за каждую пару рук сверх первой (dbc-114)", () => {
  const arms = rating => ({ type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating } });
  it("без Черты — прежние 1 (две руки пары не добавляют)", () => {
    expect(attackActionLimit(actorFor())).toBe(1);
  });
  it("2 руки по Черте — 1; 3 (нечётная лишняя) — 2; 4 — 2; 6 — 3", () => {
    expect(attackActionLimit(actorFor({ items: [arms(2)] }))).toBe(1);
    expect(attackActionLimit(actorFor({ items: [arms(3)] }))).toBe(2);
    expect(attackActionLimit(actorFor({ items: [arms(4)] }))).toBe(2);
    expect(attackActionLimit(actorFor({ items: [arms(6)] }))).toBe(3);
  });
  it("потерянная рука считается: 4 руки, одна потеряна → 3 доступных → 2 Атаки", () => {
    const a = actorFor({ items: [arms(4)] });
    a.system.conditions = { lostArmsCount: 1 };
    expect(attackActionLimit(a)).toBe(2);
  });
  it("лишние руки без самой Черты Атаку не добавляют", () => {
    expect(attackActionLimit(actorFor({ extraHands: 2 }))).toBe(1);
  });
  it("не более 2+P.b рук за Ход (55-15): 6 рук при P.b 2 → 4 руки → 2 Атаки; при P.b 4 — все 6 → 3", () => {
    expect(attackActionLimit(actorFor({ items: [arms(6)], characteristics: { per: { bonus: 2 } } }))).toBe(2);
    expect(attackActionLimit(actorFor({ items: [arms(6)], characteristics: { per: { bonus: 4 } } }))).toBe(3);
    expect(attackActionLimit(actorFor({ items: [arms(6)], characteristics: { per: { bonus: 0 } } }))).toBe(1);
  });
});

describe("сосредоточение на мехадендритах до метки (приёмка #597)", () => {
  const dendrite = id => ({ id, type: "weapon", name: `Боевой мехадендрит ${id}`, system: { profileLabel: "Мехадендрит" } });
  it("объявленное в окне сосредоточение поднимает Лимит без метки на акторе", () => {
    const items = [{ id: "t", type: "talent", name: "Mechadendrite Use (Weapon)", system: {} }, ...["a", "b", "c", "d", "e"].map(dendrite)];
    items.get = id => items.find(i => i.id === id);
    const actor = actorFor({ items });
    expect(attackActionLimit(actor)).toBe(1);
    expect(attackActionLimit(actor, { dendriteFocus: true })).toBe(3);
  });

  it("окно атаки ставит метку сосредоточения и снимает пропуск Завесы только после списания ОД", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../module/sheets/attack/dialog.mjs", import.meta.url), "utf8");
    const take = src.indexOf("await takeAttackAction(actor);");
    const spend = src.indexOf("await spendActionPoints(actor, apCost, { physical: true, attack: true })");
    for (const needle of ['await actor.setFlag("warhammer-dbc", DENDRITE_FOCUS_FLAG, true)', 'await actor.unsetFlag("warhammer-dbc", VEIL_PIERCE_FLAG)']) {
      const at = src.indexOf(needle);
      expect(src.indexOf(needle, at + 1), needle).toBe(-1);
      expect(at, needle).toBeGreaterThan(spend);
      expect(at - take, needle).toBeLessThan(300);
    }
    expect(src).toMatch(/canTakeAttackAction\(actor, \{ dendriteFocus: dendriteMode === "focus" \}\)/);
  });
});
