// test/combat/action-economy.test.mjs
//
// Экономика действий (стр. 12): 2 ОД + 1 Реакция в начале своего Хода,
// тратятся Полудействием/Полным действием/Реакцией, не тратятся вне
// активного Encounter, восполняются каждый Ход. Стойка модифицирует пул
// Реакций (Агрессивная теряет 1 в конце Хода, Защитная даёт +1 на Избегание).

import "../support/foundry-stub.mjs";
import { captured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  hasActionEconomy, isEncounterActive, resetActionEconomy,
  applyTurnEndStanceEffects, apCostForActionType,
  canSpendActionPoints, spendActionPoints,
  canSpendReaction, spendReaction, effectiveDefenseReactionMax,
  effectiveActionPointsMax,
  postTurnStartCard, apSpendGate, reactionSpendGate
} from "../../module/combat/action-economy.mjs";

/** Актор-стрелок из module/data/actor/_creature.mjs — только нужные поля. */
function actorFor({ type = "character", meleeStance = "standard", ...overrides } = {}) {
  const store = {};
  const doc = {
    type,
    system: {
      meleeStance,
      actionPoints: { value: 2, max: 2 },
      reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 },
      ...overrides
    }
  };
  doc.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const m = path.match(/^flags\.([^.]+)\.(-=)?(.+)$/);
      if (m) {
        const [, scope, del, key] = m;
        if (del) delete store[`${scope}.${key}`]; else store[`${scope}.${key}`] = value;
        continue;
      }
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return doc;
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("hasActionEconomy", () => {
  it("существа (character/daemon/demonPrince/minion) несут экономику действий", () => {
    for (const type of ["character", "daemon", "demonPrince", "minion"])
      expect(hasActionEconomy(actorFor({ type }))).toBe(true);
  });
  it("Орда/техника — нет", () => {
    expect(hasActionEconomy(actorFor({ type: "horde" }))).toBe(false);
    expect(hasActionEconomy(actorFor({ type: "vehicle" }))).toBe(false);
  });
});

describe("isEncounterActive", () => {
  it("без Combat или без запуска — не активен", () => {
    expect(isEncounterActive()).toBe(false);
    globalThis.game.combat = { started: false };
    expect(isEncounterActive()).toBe(false);
  });
  it("started: true — активен", () => {
    globalThis.game.combat = { started: true };
    expect(isEncounterActive()).toBe(true);
  });
});

describe("apCostForActionType", () => {
  it("Полное действие — 2 ОД, Полудействие — 1, остальное бесплатно", () => {
    expect(apCostForActionType("Полное действие")).toBe(2);
    expect(apCostForActionType("Полудействие")).toBe(1);
    expect(apCostForActionType("Свободное действие")).toBe(0);
    expect(apCostForActionType(undefined)).toBe(0);
  });
});

describe("resetActionEconomy", () => {
  it("восполняет ОД и Реакции до максимума", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.system.reactions.value).toBe(1);
  });

  // Подавление (стр. 33): в укрытии — только 1 ОД в свой Ход, не полный запас.
  it.each([
    ["Подавленный актор получает только 1 ОД вместо полного максимума", 2, true, 1],
    ["Подавленный актор с max 0 (нет экономики) — Math.min не поднимает выше max", 0, true, 0],
    ["без Подавления — полный запас ОД как обычно", 2, false, 2]
  ])("%s", async (_title, max, pinned, expected) => {
    const actor = actorFor({ actionPoints: { value: 0, max }, conditions: { pinned } });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(expected);
  });

  // Оглушение/Ступор (стр. 30-31, wdbc-r5o7.3): «не может совершать Действия
  // и Реакции» — абсолютный запрет (0), а не просто урезание, и сильнее
  // Подавленного (min 1) при обоих сразу.
  it.each([
    ["Оглушён — 0 ОД, 0 Реакций, 0 доп. Реакций на Избегание", { stunned: true }],
    ["в Ступоре — тот же запрет (Ступор = Оглушение «для прочих эффектов»)", { dazed: true }]
  ])("%s", async (_title, conditions) => {
    const actor = actorFor({
      actionPoints: { value: 0, max: 2 },
      reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 1 },
      conditions
    });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(actor.system.reactions.value).toBe(0);
    expect(actor.system.reactions.defenseValue).toBe(0);
  });

  it("Оглушён и Подавлен разом — Оглушение побеждает (0, не 1)", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, conditions: { stunned: true, pinned: true } });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(0);
  });

  it("не Оглушён и не в Ступоре — экономика восполняется как обычно", async () => {
    const actor = actorFor({
      actionPoints: { value: 0, max: 2 },
      reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 },
      conditions: { stunned: false, dazed: false }
    });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.system.reactions.value).toBe(1);
  });

  // Determination To Fight/Решительность Сражаться (wdbc-1rno): +1 ОД при
  // отрицательных Ранах — тот же динамический бонус, что Стойка у Реакций.
  it("Determination To Fight + отрицательные Раны — восполняет ОД с учётом +1", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, wounds: { tier: "dying" } });
    actor.items = [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }];
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(3);
  });

  it("Подавленный побеждает даже с бонусом Determination To Fight — min(1, ...)", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, wounds: { tier: "dying" }, conditions: { pinned: true } });
    actor.items = [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }];
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it.each([
    ["Защитная Стойка даёт +1 доп. Реакцию на Избегание при сбросе", "defensive", 1],
    ["Стандартная Стойка не даёт доп. Реакцию", "standard", 0]
  ])("%s", async (_title, meleeStance, expected) => {
    const actor = actorFor({ meleeStance });
    await resetActionEconomy(actor);
    expect(actor.system.reactions.defenseValue).toBe(expected);
  });

  it("снимает флаг «раскрыт» (Агрессивная Стойка, потерявшая все Реакции в прошлый Ход)", async () => {
    const actor = actorFor();
    await actor.setFlag("warhammer-dbc", "exposedAggressive", true);
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "exposedAggressive")).toBeUndefined();
  });

  // Импульсное (movement-actions.mjs, markMovedThisTurn): «не двигался с
  // прошлого раунда» начинается заново с каждым Ходом этого актора.
  it("снимает флаг «двигался в этом Ходу» (Импульсное — movement-actions.mjs)", async () => {
    const actor = actorFor();
    await actor.setFlag("warhammer-dbc", "movedThisTurn", true);
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
  });

  // Snapshot/Выстрел Навскидку (wdbc-1rno, movement-actions.mjs,
  // markMoveDegreeThisTurn): категория «сколько подвигался» тоже начинается
  // заново с каждым Ходом этого актора, тем же тактом, что и movedThisTurn.
  it("снимает флаг «категория движения в этом Ходу» (Snapshot — movement-actions.mjs)", async () => {
    const actor = actorFor();
    await actor.setFlag("warhammer-dbc", "moveDegreeThisTurn", "full");
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBeUndefined();
  });

  // Just the Light/Лишь Свет (wdbc-1rno, combat/just-the-light.mjs): щит
  // живёт «до начала следующего Хода» — тот же приём, что running/exposedAggressive.
  it("снимает флаг щита Лишь Свет (Just the Light — combat/just-the-light.mjs)", async () => {
    const actor = actorFor();
    await actor.setFlag("warhammer-dbc", "justTheLightActive", true);
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "justTheLightActive")).toBeUndefined();
  });

  it("Орда/техника — ничего не делает", async () => {
    const actor = actorFor({ type: "horde", actionPoints: { value: 0, max: 2 } });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(0); // update ни разу не вызван
  });
});

describe("applyTurnEndStanceEffects", () => {
  it("Агрессивная Стойка с доступной Реакцией теряет её в конце Хода", async () => {
    const actor = actorFor({ meleeStance: "aggressive", reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    await applyTurnEndStanceEffects(actor);
    expect(actor.system.reactions.value).toBe(0);
    expect(actor.getFlag("warhammer-dbc", "exposedAggressive")).toBeUndefined();
  });

  it("Агрессивная Стойка без Реакций — актор помечается «раскрытым»", async () => {
    const actor = actorFor({ meleeStance: "aggressive", reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    await applyTurnEndStanceEffects(actor);
    expect(actor.getFlag("warhammer-dbc", "exposedAggressive")).toBe(true);
  });

  it("другие Стойки не теряют Реакцию в конце Хода", async () => {
    const actor = actorFor({ meleeStance: "defensive", reactions: { value: 1, max: 1, defenseValue: 1, defenseMax: 0 } });
    await applyTurnEndStanceEffects(actor);
    expect(actor.system.reactions.value).toBe(1);
  });
});

describe("canSpendActionPoints / spendActionPoints", () => {
  it("вне Encounter трата всегда проходит и ничего не списывает", async () => {
    const actor = actorFor({ actionPoints: { value: 1, max: 2 } });
    expect(canSpendActionPoints(actor, 2)).toBe(true);
    expect(await spendActionPoints(actor, 2)).toBe(true);
    expect(actor.system.actionPoints.value).toBe(1); // не изменилось
  });

  it("в активном Encounter хватает ОД — списывает", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    expect(await spendActionPoints(actor, 1)).toBe(true);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("в активном Encounter не хватает ОД — блокирует, ничего не тратит", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 1, max: 2 } });
    expect(canSpendActionPoints(actor, 2)).toBe(false);
    expect(await spendActionPoints(actor, 2)).toBe(false);
    expect(actor.system.actionPoints.value).toBe(1);
  });
});

describe("canSpendReaction / spendReaction", () => {
  it("вне Encounter — всегда доступна, ничего не списывает", async () => {
    globalThis.game.combat = { started: false };
    const actor = actorFor({ reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    expect(await spendReaction(actor)).toBe(true);
    expect(actor.system.reactions.value).toBe(0);
  });

  it("forDefense тратит доп. пул на Избегание раньше универсального", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ reactions: { value: 1, max: 1, defenseValue: 1, defenseMax: 0 } });
    expect(await spendReaction(actor, { forDefense: true })).toBe(true);
    expect(actor.system.reactions.defenseValue).toBe(0);
    expect(actor.system.reactions.value).toBe(1); // универсальная не тронута
  });

  it("без доп. пула forDefense падает на универсальную Реакцию", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    expect(await spendReaction(actor, { forDefense: true })).toBe(true);
    expect(actor.system.reactions.value).toBe(0);
  });

  it("нет ни одной доступной Реакции — блокирует", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    expect(canSpendReaction(actor, { forDefense: true })).toBe(false);
    expect(await spendReaction(actor, { forDefense: true })).toBe(false);
  });
});

describe("effectiveDefenseReactionMax", () => {
  it("Защитная Стойка — 1, без неё — 0 (без надбавок Талантов)", () => {
    expect(effectiveDefenseReactionMax(actorFor({ meleeStance: "defensive" }))).toBe(1);
    expect(effectiveDefenseReactionMax(actorFor({ meleeStance: "standard" }))).toBe(0);
  });
});

describe("effectiveActionPointsMax", () => {
  it("без Determination To Fight/отрицательных Ран — статичный max как есть", () => {
    expect(effectiveActionPointsMax(actorFor({ actionPoints: { value: 2, max: 2 } }))).toBe(2);
  });

  it("Determination To Fight + отрицательные Раны — +1", () => {
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, wounds: { tier: "dying" } });
    actor.items = [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }];
    expect(effectiveActionPointsMax(actor)).toBe(3);
  });

  it("Талант есть, но Раны не отрицательные — без бонуса", () => {
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, wounds: { tier: "heavy" } });
    actor.items = [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }];
    expect(effectiveActionPointsMax(actor)).toBe(2);
  });
});

// wdbc-qjnk: гейт кнопок ДО клика (disabled+title), а не тост после клика.
describe("apSpendGate / reactionSpendGate", () => {
  it("вне Encounter всегда {disabled: false}, даже при 0 ОД/Реакций", () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    expect(apSpendGate(actor, 2)).toEqual({ disabled: false, title: "" });
    expect(reactionSpendGate(actor)).toEqual({ disabled: false, title: "" });
  });

  it("в Encounter при нехватке ОД — disabled с причиной («нужно X, есть Y»)", () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 1, max: 2 } });
    const gate = apSpendGate(actor, 2);
    expect(gate.disabled).toBe(true);
    expect(gate.title).toBe("Не хватает ОД: нужно 2, есть 1");
  });

  it("в Encounter при достаточном ОД — не гейтится", () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    expect(apSpendGate(actor, 2)).toEqual({ disabled: false, title: "" });
  });

  it("cost 0 (напр. Натиск — ОД спишутся позже, на броске атаки) не гейтится", () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 0, max: 2 } });
    expect(apSpendGate(actor, 0)).toEqual({ disabled: false, title: "" });
  });

  it("в Encounter без Реакций — disabled", () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    expect(reactionSpendGate(actor)).toEqual({ disabled: true, title: "Не хватает Реакций" });
  });
});

// wdbc-qjnk: карточка «сколько у меня ОД/Реакций» в начале своего Хода.
describe("postTurnStartCard", () => {
  it("постит в чат карточку с текущими ОД и Реакциями", async () => {
    captured.chat = [];
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    actor.name = "Тестовый";
    await postTurnStartCard(actor);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Тестовый");
    expect(captured.chat[0].content).toContain("ОД");
    expect(captured.chat[0].content).toContain("2");
    expect(captured.chat[0].content).toContain("Реакции");
  });

  it("Орда/техника — ничего не постит (нет экономики действий)", async () => {
    captured.chat = [];
    const actor = actorFor({ type: "horde" });
    await postTurnStartCard(actor);
    expect(captured.chat).toHaveLength(0);
  });
});
