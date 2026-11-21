// test/combat/full-move-half-action.test.mjs
//
// Sahara task-5003 (dbc-38): «Полное Движение — Полное действие: персонаж
// перемещается до SPD×2, после чего может совершить любое полудействие, не
// являющееся атакой, но если оно требует тестов, эти тесты получают Помеху».
// Раньше Полное Движение съедало оба ОД, и полудействию платить было нечем.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import {
  canSpendActionPoints, spendActionPoints, apSpendGate,
  FULL_MOVE_HALF_FLAG, fullMoveHindranceActive
} from "../../module/combat/action-economy.mjs";
import { declareFullMove } from "../../module/combat/movement-actions.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 } } = {}) {
  const store = {};
  const doc = {
    name: "Бегун", type: "character", items: [], uuid: "Actor.run",
    system: { actionPoints, reactions: { value: 1, max: 1 }, movement: { halfMove: 4, move: 8 },
      characteristics: { s: { total: 40, bonus: 4 }, ag: { total: 35, bonus: 3 } } }
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  doc.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true }; });

describe("Полное Движение оставляет полудействие (не атаку)", () => {
  it("после Полного Движения 0 ОД, но полудействие не-атака проходит", async () => {
    const actor = actorFor();
    await declareFullMove(actor);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(actor.getFlag("warhammer-dbc", FULL_MOVE_HALF_FLAG)).toBe(true);
    expect(canSpendActionPoints(actor, 1)).toBe(true);
    expect(apSpendGate(actor, 1).disabled).toBe(false);
    expect(await spendActionPoints(actor, 1)).toBe(true);
    // полудействие одно — второе уже не проходит
    expect(actor.getFlag("warhammer-dbc", FULL_MOVE_HALF_FLAG)).toBeFalsy();
    expect(await spendActionPoints(actor, 1)).toBe(false);
  });

  it("атаку это полудействие не оплачивает", async () => {
    const actor = actorFor();
    await declareFullMove(actor);
    expect(canSpendActionPoints(actor, 1, { physical: true, attack: true })).toBe(false);
    expect(await spendActionPoints(actor, 1, { physical: true, attack: true })).toBe(false);
    expect(actor.getFlag("warhammer-dbc", FULL_MOVE_HALF_FLAG)).toBe(true);
  });

  it("Полное действие (2 ОД) им не оплатить", async () => {
    const actor = actorFor();
    await declareFullMove(actor);
    expect(canSpendActionPoints(actor, 2)).toBe(false);
  });

  it("Стрельба от Бедра полудействия не оставляет (выстрел и есть часть того же действия)", async () => {
    const actor = actorFor();
    await declareFullMove(actor, { hipShooting: true });
    expect(actor.getFlag("warhammer-dbc", FULL_MOVE_HALF_FLAG)).toBeFalsy();
  });

  it("метка живёт до начала следующего своего Хода", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(FULL_MOVE_HALF_FLAG);
  });
});

describe("Помеха тестам полудействия после Полного Движения", () => {
  it("в свой Ход после Полного Движения — Помеха в окне теста", async () => {
    const actor = actorFor();
    globalThis.game.combat = { started: true, combatant: { actor } };
    await declareFullMove(actor);
    expect(fullMoveHindranceActive(actor)).toBe(true);
  });

  it("в чужой Ход (Реакция, встречный тест) — без Помехи", async () => {
    const actor = actorFor();
    await declareFullMove(actor);
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.other" } } };
    expect(fullMoveHindranceActive(actor)).toBe(false);
  });

  it("без Полного Движения — без Помехи", () => {
    const actor = actorFor();
    globalThis.game.combat = { started: true, combatant: { actor } };
    expect(fullMoveHindranceActive(actor)).toBe(false);
  });
});
