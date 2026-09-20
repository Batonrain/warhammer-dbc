// test/combat/delay-action.test.mjs
//
// Стр. 12, wdbc-x1nz.2.42: Задержка — Полудействие, заканчивает Ход, сохраняет
// 1 ОД (не «оставшиеся», а ровно одно). Банкованное ОД нельзя тратить на
// Атаку, если персонаж уже атаковал в тот Ход, когда объявил Задержку.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { declareDelay, delayBlocksAttack, isActorsOwnTurn, postDelaySimultaneousCard }
  from "../../module/combat/delay-action.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 }, id = "actor-1", uuid = "Actor.actor-1", attackedThisTurn = [] } = {}) {
  const store = { "warhammer-dbc.attackedThisTurn": attackedThisTurn };
  const doc = {
    id, uuid, name: "Подставной", type: "character",
    system: { actionPoints, characteristics: { ag: { total: 40 } } }
  };
  doc.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      if (path.startsWith("flags.")) { store[path.slice(6)] = value; continue; }
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  return doc;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("declareDelay", () => {
  it("вне боя — предупреждение, ОД не трогает", async () => {
    const actor = actorFor();
    await declareDelay(actor);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.chat).toHaveLength(0);
  });

  it("в бою, есть ОД — урезает до РОВНО 1 (не «оставшиеся»)", async () => {
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.someone-else" } } };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await declareDelay(actor);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(captured.chat).toHaveLength(1);
  });

  it("в бою, 0 ОД — блокируется", async () => {
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.someone-else" } } };
    const actor = actorFor({ actionPoints: { value: 0, max: 2 } });
    await declareDelay(actor);
    expect(captured.chat).toHaveLength(0);
  });

  it("уже атаковал в этот Ход — ставит delayNoAttack", async () => {
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.someone-else" } } };
    const actor = actorFor({ attackedThisTurn: ["weapon-1"] });
    await declareDelay(actor);
    expect(delayBlocksAttack(actor)).toBe(true);
  });

  it("не атаковал в этот Ход — delayNoAttack не ставится", async () => {
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.someone-else" } } };
    const actor = actorFor();
    await declareDelay(actor);
    expect(delayBlocksAttack(actor)).toBe(false);
  });

  it("объявлена в СВОЙ Ход — двигает трекер (combat.nextTurn)", async () => {
    let nextTurnCalled = false;
    globalThis.game.combat = {
      started: true, combatant: { actor: { uuid: "Actor.actor-1" } },
      nextTurn: async () => { nextTurnCalled = true; }
    };
    const actor = actorFor({ uuid: "Actor.actor-1" });
    await declareDelay(actor);
    expect(nextTurnCalled).toBe(true);
  });

  it("объявлена НЕ в свой Ход (использование банка позже) — трекер не двигает", async () => {
    let nextTurnCalled = false;
    globalThis.game.combat = {
      started: true, combatant: { actor: { uuid: "Actor.someone-else" } },
      nextTurn: async () => { nextTurnCalled = true; }
    };
    const actor = actorFor({ uuid: "Actor.actor-1" });
    await declareDelay(actor);
    expect(nextTurnCalled).toBe(false);
  });
});

describe("isActorsOwnTurn", () => {
  it("совпадает с combat.combatant.actor.uuid — true", () => {
    globalThis.game.combat = { combatant: { actor: { uuid: "Actor.a1" } } };
    expect(isActorsOwnTurn({ uuid: "Actor.a1" })).toBe(true);
  });
  it("не совпадает — false", () => {
    globalThis.game.combat = { combatant: { actor: { uuid: "Actor.a2" } } };
    expect(isActorsOwnTurn({ uuid: "Actor.a1" })).toBe(false);
  });
  it("нет combat вовсе — false", () => {
    globalThis.game.combat = undefined;
    expect(isActorsOwnTurn({ uuid: "Actor.a1" })).toBe(false);
  });
});

describe("postDelaySimultaneousCard", () => {
  it("постит карточку с победителем очерёдности", async () => {
    globalThis.game.combat = { combatants: [] };
    const delaying = actorFor({ id: "d1" });
    delaying.system.characteristics.ag.total = 50;
    const acting = actorFor({ id: "a1" });
    acting.system.characteristics.ag.total = 30;
    await postDelaySimultaneousCard(delaying, acting);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain(delaying.name);
  });
});
