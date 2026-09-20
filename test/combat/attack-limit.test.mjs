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
