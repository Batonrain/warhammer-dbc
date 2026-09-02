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
  worldTimeRemaining, isWorldTimeCooldownReady, markWorldTimeCooldownUsed,
  THROTTLE_UNITS, isThrottleReady, markThrottleUsed,
  throttleCount, isThrottleCountAvailable, incrementThrottleCount
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

describe("isThrottleReady / markThrottleUsed — диспетчер «Частоты» для kind:\"script\" (wdbc-f4jt)", () => {
  function docWithFlags() {
    const store = {};
    return {
      getFlag: (scope, key) => store[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
    };
  }

  it("THROTTLE_UNITS перечисляет ровно 6 единиц", () => {
    expect(THROTTLE_UNITS).toEqual(["round", "battle", "scene", "session", "day", "month"]);
  });

  it("round: делегирует в isCapabilityAvailable/markCapabilityUsed", async () => {
    globalThis.game.combat = { round: 1 };
    const doc = docWithFlags();
    expect(isThrottleReady(doc, "flag", "round")).toBe(true);
    await markThrottleUsed(doc, "flag", "round");
    expect(isThrottleReady(doc, "flag", "round")).toBe(false);
    globalThis.game.combat = { round: 2 };
    expect(isThrottleReady(doc, "flag", "round")).toBe(true);
  });

  it("battle: делегирует в isCapabilityAvailable/markCapabilityUsed", async () => {
    globalThis.game.combat = { id: "combat-1", round: 1 };
    const doc = docWithFlags();
    await markThrottleUsed(doc, "flag", "battle");
    expect(isThrottleReady(doc, "flag", "battle")).toBe(false);
    globalThis.game.combat = { id: "combat-2", round: 1 };
    expect(isThrottleReady(doc, "flag", "battle")).toBe(true);
  });

  it("scene/session: делегирует в isRuleUsageUsed/markRuleUsageUsed, сброс не автоматический", async () => {
    globalThis.game.combat = { id: "combat-1", round: 1 };
    const doc = docWithFlags();
    await markThrottleUsed(doc, "flag", "session");
    expect(isThrottleReady(doc, "flag", "session")).toBe(false);
    globalThis.game.combat = { id: "combat-2", round: 2 };
    expect(isThrottleReady(doc, "flag", "session")).toBe(false);
  });

  it("day: делегирует в isWorldTimeCooldownReady/markWorldTimeCooldownUsed с интервалом в сутки", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const doc = docWithFlags();
    await markThrottleUsed(doc, "flag", "day");
    expect(isThrottleReady(doc, "flag", "day")).toBe(false);
    globalThis.game.time = { worldTime: 100000 + 86400 + 1 };
    expect(isThrottleReady(doc, "flag", "day")).toBe(true);
  });

  it("month: делегирует в isWorldTimeCooldownReady/markWorldTimeCooldownUsed с интервалом в 30 суток (wdbc-1rno)", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const doc = docWithFlags();
    await markThrottleUsed(doc, "flag", "month");
    expect(isThrottleReady(doc, "flag", "month")).toBe(false);
    globalThis.game.time = { worldTime: 100000 + 30 * 86400 + 1 };
    expect(isThrottleReady(doc, "flag", "month")).toBe(true);
  });

  it("неизвестная/пустая единица — всегда готово, markThrottleUsed ничего не пишет", async () => {
    const doc = docWithFlags();
    expect(isThrottleReady(doc, "flag", "")).toBe(true);
    await markThrottleUsed(doc, "flag", "");
    expect(isThrottleReady(doc, "flag", "")).toBe(true);
  });
});

describe("throttleCount / isThrottleCountAvailable / incrementThrottleCount — «до N раз» (wdbc-f4jt)", () => {
  function docWithFlags() {
    const store = {};
    return {
      getFlag: (scope, key) => store[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
    };
  }

  it("без метки — счётчик 0, доступно", () => {
    const doc = docWithFlags();
    expect(throttleCount(doc, "flag", "session")).toBe(0);
    expect(isThrottleCountAvailable(doc, "flag", "session", 3)).toBe(true);
  });

  it("session: копится до max, дальше недоступно", async () => {
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "session", 3);
    await incrementThrottleCount(doc, "flag", "session", 3);
    expect(throttleCount(doc, "flag", "session")).toBe(2);
    expect(isThrottleCountAvailable(doc, "flag", "session", 3)).toBe(true);
    await incrementThrottleCount(doc, "flag", "session", 3);
    expect(throttleCount(doc, "flag", "session")).toBe(3);
    expect(isThrottleCountAvailable(doc, "flag", "session", 3)).toBe(false);
    // Молча не превышает max дальше.
    await incrementThrottleCount(doc, "flag", "session", 3);
    expect(throttleCount(doc, "flag", "session")).toBe(3);
  });

  it("round: живое сравнение — смена Раунда обнуляет счётчик", async () => {
    globalThis.game.combat = { round: 1 };
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "round", 2);
    expect(throttleCount(doc, "flag", "round")).toBe(1);
    globalThis.game.combat = { round: 2 };
    expect(throttleCount(doc, "flag", "round")).toBe(0);
    expect(isThrottleCountAvailable(doc, "flag", "round", 2)).toBe(true);
  });

  it("battle: живое сравнение по combat.id", async () => {
    globalThis.game.combat = { id: "combat-1", round: 1 };
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "battle", 2);
    await incrementThrottleCount(doc, "flag", "battle", 2);
    expect(throttleCount(doc, "flag", "battle")).toBe(2);
    globalThis.game.combat = { id: "combat-2", round: 1 };
    expect(throttleCount(doc, "flag", "battle")).toBe(0);
  });

  it("без документа/без Combat (round/battle) ничего не пишет", async () => {
    await expect(incrementThrottleCount(null, "flag", "session", 3)).resolves.toBeUndefined();
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "round", 3);
    expect(doc.getFlag("warhammer-dbc", "usageLimits.flag")).toBeUndefined();
  });

  it("метка одной записи не трогает другую", async () => {
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag.a", "session", 3);
    expect(throttleCount(doc, "flag.b", "session")).toBe(0);
  });

  it("day: живое сравнение по номеру календарных суток (Skillful Torture, wdbc-sk8s) — смена суток обнуляет", async () => {
    globalThis.game.time = { worldTime: 0 };
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "day", 2);
    await incrementThrottleCount(doc, "flag", "day", 2);
    expect(throttleCount(doc, "flag", "day")).toBe(2);
    expect(isThrottleCountAvailable(doc, "flag", "day", 2)).toBe(false);

    // Тот же день (частично прошли сутки) — счётчик не сбрасывается.
    globalThis.game.time = { worldTime: 40000 };
    expect(throttleCount(doc, "flag", "day")).toBe(2);

    // Наступили новые сутки — счётчик обнуляется.
    globalThis.game.time = { worldTime: 86400 + 10 };
    expect(throttleCount(doc, "flag", "day")).toBe(0);
    expect(isThrottleCountAvailable(doc, "flag", "day", 2)).toBe(true);
  });

  it("day: не путается с worldTime-семьёй isThrottleReady (та же строка unit, разная плоскость хранения)", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "day", 3);
    // isThrottleReady/markThrottleUsed для "day" — интервал между использованиями,
    // читает СОВСЕМ другой флаг (не usageLimits.<key>) — счётчик его не трогает.
    expect(isThrottleReady(doc, "flag", "day")).toBe(true);
  });

  it("month: живое сравнение по номеру условного 30-суточного месяца (wdbc-1rno, Vampiric Dependency/Warp Eater) — смена месяца обнуляет", async () => {
    globalThis.game.time = { worldTime: 0 };
    const doc = docWithFlags();
    await incrementThrottleCount(doc, "flag", "month", 2);
    await incrementThrottleCount(doc, "flag", "month", 2);
    expect(throttleCount(doc, "flag", "month")).toBe(2);
    expect(isThrottleCountAvailable(doc, "flag", "month", 2)).toBe(false);

    // Тот же месяц (частично прошло) — счётчик не сбрасывается.
    globalThis.game.time = { worldTime: 10 * 86400 };
    expect(throttleCount(doc, "flag", "month")).toBe(2);

    // Наступил новый месяц — счётчик обнуляется.
    globalThis.game.time = { worldTime: 30 * 86400 + 10 };
    expect(throttleCount(doc, "flag", "month")).toBe(0);
    expect(isThrottleCountAvailable(doc, "flag", "month", 2)).toBe(true);
  });
});
