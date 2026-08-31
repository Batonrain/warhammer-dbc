// test/rules/cooldown.test.mjs
//
// module/rules/cooldown.mjs — обобщённый троттлинг «раз в X» (wdbc-f4jt):
// round/battle (живое текущее значение из Combat) и worldTime (интервал
// от сохранённого момента). Round-кейсы дублируют test/apps/game-session.test.mjs
// намеренно — game-session.mjs теперь тонкая обёртка над этим модулем и должен
// вести себя байт-в-байт как раньше.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  isCapabilityAvailable, markCapabilityUsed,
  isRuleUsageUsed, markRuleUsageUsed,
  worldTimeRemaining, isWorldTimeCooldownReady, markWorldTimeCooldownUsed
} from "../../module/rules/cooldown.mjs";

function actorWithFlags() {
  const store = {};
  return {
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("isCapabilityAvailable / markCapabilityUsed — round", () => {
  it("без активного Combat считается доступной", () => {
    const actor = actorWithFlags();
    expect(isCapabilityAvailable(actor, "some.flag", "round")).toBe(true);
  });

  it("после markCapabilityUsed недоступна в том же Раунде", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "some.flag", "round");
    expect(isCapabilityAvailable(actor, "some.flag", "round")).toBe(false);
  });

  it("новый Раунд возвращает доступность", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "some.flag", "round");
    globalThis.game.combat = { round: 2 };
    expect(isCapabilityAvailable(actor, "some.flag", "round")).toBe(true);
  });

  it("метка одной возможности не трогает другую", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "some.flag", "round");
    expect(isCapabilityAvailable(actor, "other.flag", "round")).toBe(true);
  });
});

describe("isCapabilityAvailable / markCapabilityUsed — battle", () => {
  it("без активного Combat считается доступной", () => {
    const actor = actorWithFlags();
    expect(isCapabilityAvailable(actor, "flag", "battle")).toBe(true);
  });

  it("после markCapabilityUsed недоступна, пока идёт тот же бой (тот же combat.id), даже со сменой Раунда", async () => {
    globalThis.game.combat = { id: "combat-1", round: 1 };
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "flag", "battle");
    globalThis.game.combat = { id: "combat-1", round: 2 };
    expect(isCapabilityAvailable(actor, "flag", "battle")).toBe(false);
  });

  it("новый бой (другой combat.id) возвращает доступность", async () => {
    globalThis.game.combat = { id: "combat-1", round: 1 };
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "flag", "battle");
    globalThis.game.combat = { id: "combat-2", round: 1 };
    expect(isCapabilityAvailable(actor, "flag", "battle")).toBe(true);
  });
});

describe("isCapabilityAvailable — nextRound (Медленная Перезарядка)", () => {
  it("заблокирована в раунд использования И в следующий, доступна через один", async () => {
    globalThis.game.combat = { round: 3 };
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "slowReload", "round");
    expect(isCapabilityAvailable(actor, "slowReload", "nextRound")).toBe(false); // тот же СХ
    globalThis.game.combat = { round: 4 };
    expect(isCapabilityAvailable(actor, "slowReload", "nextRound")).toBe(false); // следующий СХ
    globalThis.game.combat = { round: 5 };
    expect(isCapabilityAvailable(actor, "slowReload", "nextRound")).toBe(true);
  });

  it("без Combat и без отметки — доступна; откат раунда назад не блокирует навсегда", async () => {
    const actor = actorWithFlags();
    expect(isCapabilityAvailable(actor, "slowReload", "nextRound")).toBe(true);
    globalThis.game.combat = { round: 5 };
    await markCapabilityUsed(actor, "slowReload", "round");
    globalThis.game.combat = { round: 2 };  // ГМ отмотал бой назад
    expect(isCapabilityAvailable(actor, "slowReload", "nextRound")).toBe(true);
  });
});

describe("isRuleUsageUsed / markRuleUsageUsed — scene/session (сброс явной кнопкой, не живым значением)", () => {
  it("не отмечена — не израсходована", () => {
    const actor = actorWithFlags();
    expect(isRuleUsageUsed(actor, "some.faith")).toBe(false);
  });

  it("после markRuleUsageUsed(scope по умолчанию scene) — израсходована", async () => {
    const actor = actorWithFlags();
    await markRuleUsageUsed(actor, "some.faith");
    expect(isRuleUsageUsed(actor, "some.faith")).toBe(true);
  });

  it("смена Раунда/боя НЕ сбрасывает — сброс только явным действием (game-session.mjs::resetUsageLimit)", async () => {
    globalThis.game.combat = { id: "combat-1", round: 1 };
    const actor = actorWithFlags();
    await markRuleUsageUsed(actor, "some.faith", "scene");
    globalThis.game.combat = { id: "combat-2", round: 2 };
    expect(isRuleUsageUsed(actor, "some.faith")).toBe(true);
  });

  it("scope записывается в метку — resetUsageLimit фильтрует по нему", async () => {
    const actor = actorWithFlags();
    await markRuleUsageUsed(actor, "some.faith", "session");
    expect(actor.getFlag("warhammer-dbc", "usageLimits.some-faith")).toEqual({ scope: "session", used: true });
  });

  it("без актора ничего не пишет", async () => {
    await expect(markRuleUsageUsed(null, "some.faith")).resolves.toBeUndefined();
  });
});

describe("markCapabilityUsed — защита от отсутствующих данных", () => {
  it("без актора ничего не пишет", async () => {
    await expect(markCapabilityUsed(null, "flag", "round")).resolves.toBeUndefined();
  });

  it("без Combat ничего не пишет", async () => {
    const actor = actorWithFlags();
    await markCapabilityUsed(actor, "flag", "round");
    expect(actor.getFlag("warhammer-dbc", "usageLimits.flag")).toBeUndefined();
  });
});

describe("worldTimeRemaining", () => {
  it("нет usedAt — доступно сейчас", () => {
    expect(worldTimeRemaining(null, 100000, 86400)).toBe(0);
  });
  it("использовано только что — весь интервал в запасе", () => {
    expect(worldTimeRemaining(100000, 100000, 86400)).toBe(86400);
  });
  it("прошла часть интервала — остаток посчитан", () => {
    expect(worldTimeRemaining(100000 - 20 * 3600, 100000, 86400)).toBe(4 * 3600);
  });
  it("интервал истёк — снова доступно", () => {
    expect(worldTimeRemaining(100000 - 90000, 100000, 86400)).toBe(0);
  });
  it("интервал ≤ 0 — всегда доступно", () => {
    expect(worldTimeRemaining(100000, 100000, 0)).toBe(0);
  });
});

describe("isWorldTimeCooldownReady / markWorldTimeCooldownUsed", () => {
  function docWithFlags() {
    const store = {};
    return {
      getFlag: (scope, key) => store[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
    };
  }

  it("флага нет — готово сразу", () => {
    globalThis.game.time = { worldTime: 100000 };
    expect(isWorldTimeCooldownReady(docWithFlags(), "usedAt", 3600)).toBe(true);
  });

  it("markWorldTimeCooldownUsed заводит перезарядку на текущий worldTime", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const doc = docWithFlags();
    await markWorldTimeCooldownUsed(doc, "usedAt");
    expect(doc.getFlag("warhammer-dbc", "usedAt")).toBe(100000);
    expect(isWorldTimeCooldownReady(doc, "usedAt", 3600)).toBe(false);

    globalThis.game.time = { worldTime: 100000 + 3601 };
    expect(isWorldTimeCooldownReady(doc, "usedAt", 3600)).toBe(true);
  });

  it("без документа ничего не пишет", async () => {
    await expect(markWorldTimeCooldownUsed(null, "usedAt")).resolves.toBeUndefined();
  });
});
