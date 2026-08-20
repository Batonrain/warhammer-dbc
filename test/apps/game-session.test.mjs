// test/apps/game-session.test.mjs
//
// isRoundCapabilityAvailable/markRoundCapabilityUsed — Раз-в-Раунд возможности
// актора (флаг из реестра правил, без предмета-носителя). В отличие от
// isRuleUsageUsed/markRuleUsageUsed (scope "scene"/"session"), раунд не
// откатывается кнопкой ГМа: запоминается номер раунда использования и
// сравнивается с текущим game.combat.round.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../../module/apps/game-session.mjs";

/** Актор с минимальным getFlag/setFlag — как у настоящего Foundry-документа. */
function actorWithFlags() {
  const store = {};
  return {
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("isRoundCapabilityAvailable", () => {
  it("без активного Combat считается доступной — раунд отследить нечем", () => {
    const actor = actorWithFlags();
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(true);
  });

  it("доступна, пока не отмечена использованной", () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(true);
  });

  it("после markRoundCapabilityUsed недоступна в том же Раунде", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(false);
  });

  it("новый Раунд возвращает доступность", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");

    globalThis.game.combat = { round: 2 };
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(true);
  });

  it("метка одной возможности не трогает другую", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");
    expect(isRoundCapabilityAvailable(actor, "autoHit.melee.oncePerRound")).toBe(true);
  });
});

describe("markRoundCapabilityUsed", () => {
  it("без актора или без Combat ничего не пишет", async () => {
    await expect(markRoundCapabilityUsed(null, "technique.baseFullAttack")).resolves.toBeUndefined();

    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");
    expect(actor.getFlag("warhammer-dbc", "usageLimits.technique-baseFullAttack")).toBeUndefined();
  });
});
