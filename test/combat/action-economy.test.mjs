// test/combat/action-economy.test.mjs
//
// Экономика действий (стр. 12): 2 ОД + 1 Реакция в начале своего Хода,
// тратятся Полудействием/Полным действием/Реакцией, не тратятся вне
// активного Encounter, восполняются каждый Ход. Стойка модифицирует пул
// Реакций (Агрессивная теряет 1 в конце Хода, Защитная даёт +1 на Избегание).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  hasActionEconomy, isEncounterActive, resetActionEconomy,
  applyTurnEndStanceEffects, apCostForActionType,
  canSpendActionPoints, spendActionPoints,
  canSpendReaction, spendReaction, effectiveDefenseReactionMax
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

  it("Защитная Стойка даёт +1 доп. Реакцию на Избегание при сбросе", async () => {
    const actor = actorFor({ meleeStance: "defensive" });
    await resetActionEconomy(actor);
    expect(actor.system.reactions.defenseValue).toBe(1);
  });

  it("Стандартная Стойка не даёт доп. Реакцию", async () => {
    const actor = actorFor({ meleeStance: "standard" });
    await resetActionEconomy(actor);
    expect(actor.system.reactions.defenseValue).toBe(0);
  });

  it("снимает флаг «раскрыт» (Агрессивная Стойка, потерявшая все Реакции в прошлый Ход)", async () => {
    const actor = actorFor();
    await actor.setFlag("warhammer-dbc", "exposedAggressive", true);
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "exposedAggressive")).toBeUndefined();
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
