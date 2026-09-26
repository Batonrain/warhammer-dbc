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
  applyTurnEndStanceEffects, applyAimFocusTurnEnd, apCostForActionType,
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
  it("Техника — нет", () => {
    expect(hasActionEconomy(actorFor({ type: "vehicle" }))).toBe(false);
  });
  it("Орда — да: «действует как один персонаж, имеющий обычный запас ОД»", () => {
    expect(hasActionEconomy(actorFor({ type: "horde" }))).toBe(true);
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

  // Длительное/Расширенное действие (стр. 12, wdbc-x1nz.2.27) — тоже 2 ОД за Ход.
  it("Длительное и Расширенное действие — тоже 2 ОД", () => {
    expect(apCostForActionType("Длительное действие")).toBe(2);
    expect(apCostForActionType("Расширенное действие")).toBe(2);
  });
});

// Наследие Перемен, Оружие Наследия (wdbc-1rno.35, История 9, стр. 427):
// «В начале каждого Хода бросьте 2d5» — свежий флаг каждый вызов
// resetActionEconomy, если есть экипированное Оружие Наследия с этой
// Историей; иначе прошлый флаг (если был) явно снимается.
const legacyChangeWeapon = (id = "lw1") =>
  ({ id, type: "weapon", system: { equipped: true, legacy: { active: true, historyName: "Наследие Перемен" } } });

describe("resetActionEconomy: Наследие Перемен", () => {
  it("нет Оружия Наследия — флаг не пишется", async () => {
    const actor = actorFor();
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "legacyChangeBonus")).toBeUndefined();
  });

  it("есть Оружие Наследия, не дубль — testBonus = сумма кубиков", async () => {
    const actor = actorFor();
    actor.items = [legacyChangeWeapon("lw1")];
    captured.dice = [2, 4];
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "legacyChangeBonus")).toEqual({ weaponId: "lw1", testBonus: 6, damageBonus: 0 });
  });

  it("есть Оружие Наследия, дубль — damageBonus = значение кубика", async () => {
    const actor = actorFor();
    actor.items = [legacyChangeWeapon("lw1")];
    captured.dice = [5, 5];
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "legacyChangeBonus")).toEqual({ weaponId: "lw1", testBonus: 0, damageBonus: 5 });
  });

  it("оружие снято/потеряло Историю на следующем Ходу — старый флаг снимается", async () => {
    const actor = actorFor();
    actor.items = [legacyChangeWeapon("lw1")];
    captured.dice = [1, 2];
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "legacyChangeBonus")).toBeTruthy();

    actor.items = [];
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "legacyChangeBonus")).toBeFalsy();
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
    ["в Ступоре — тот же запрет (Ступор = Оглушение «для прочих эффектов»)", { dazed: true }],
    // Без сознания (стр. 30-31, wdbc-r5o7.7): свой пункт книги («не может
    // совершать Действия и Реакции»), не производный от isStunnedOrDazed —
    // проверен тем же тестом, что и Оглушение/Ступор выше.
    ["Без сознания — тот же абсолютный запрет", { unconscious: true }]
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

  // Шок (стр. 53): «замер от ужаса» (61–80) — 0 ОД и 0 Реакций, пока в Шоке;
  // «ошеломлён» (1–20) — в следующий Ход одно Полудействие, флаг гаснет.
  it("Шок «замер» — 0 ОД и 0 Реакций", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, conditions: { shocked: true } });
    await actor.setFlag("warhammer-dbc", "shock", { apLock: true });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(actor.system.reactions.value).toBe(0);
  });

  it("Шок «ошеломлён» — 1 ОД в этот Ход, флаг снят", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 } });
    await actor.setFlag("warhammer-dbc", "shockHalfAction", true);
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(actor.getFlag("warhammer-dbc", "shockHalfAction")).toBeUndefined();
  });

  it("Без сознания и Подавлен разом — Без сознания побеждает (0, не 1)", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, conditions: { unconscious: true, pinned: true } });
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

  it("Техника — ничего не делает", async () => {
    const actor = actorFor({ type: "vehicle", actionPoints: { value: 0, max: 2 } });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(0); // update ни разу не вызван
  });

  it("Подавленная Орда получает не больше 1 ОД — как Подавленный персонаж", async () => {
    const actor = actorFor({ type: "horde", actionPoints: { value: 0, max: 2 }, conditions: { pinned: true } });
    await resetActionEconomy(actor);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  // Врасплох (стр. 12, wdbc-x1nz.2.26): «пропускает свой первый Ход» — тот же
  // абсолютный запрет, что у Оглушения/Без сознания, ПЛЮС само Состояние
  // гасится этим же сбросом (единственный их Ход, пока оно висит).
  describe("Врасплох", () => {
    it("0 ОД, 0 Реакций, 0 доп. Реакций на Избегание — как Оглушение", async () => {
      const actor = actorFor({
        actionPoints: { value: 0, max: 2 },
        reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 1 },
        conditions: { surprised: true }
      });
      await resetActionEconomy(actor);
      expect(actor.system.actionPoints.value).toBe(0);
      expect(actor.system.reactions.value).toBe(0);
      expect(actor.system.reactions.defenseValue).toBe(0);
    });

    it("снимает Состояние сразу после — это и был пропущенный первый Ход", async () => {
      const actor = actorFor({ conditions: { surprised: true } });
      await resetActionEconomy(actor);
      expect(actor.system.conditions.surprised).toBe(false);
    });

    it("следующий сброс (следующий Раунд) — снова полный ОД/Реакции", async () => {
      const actor = actorFor({
        actionPoints: { value: 0, max: 2 },
        reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 },
        conditions: { surprised: true }
      });
      await resetActionEconomy(actor); // первый Ход — заблокирован, Состояние снято
      await actor.update({ "system.actionPoints.value": 0, "system.reactions.value": 0 });
      await resetActionEconomy(actor); // второй Ход — уже без Врасплоха
      expect(actor.system.actionPoints.value).toBe(2);
      expect(actor.system.reactions.value).toBe(1);
    });

    it("Врасплох и Подавлен разом — Врасплох побеждает (0, не 1)", async () => {
      const actor = actorFor({ actionPoints: { value: 0, max: 2 }, conditions: { surprised: true, pinned: true } });
      await resetActionEconomy(actor);
      expect(actor.system.actionPoints.value).toBe(0);
    });
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

  // Стр. 12, wdbc-x1nz.2.28: «Одно Действие может вызвать только одну
  // Реакцию» — Уклонение (провал), потом Парирование НА ТУ ЖЕ АТАКУ (одна
  // карточка attack-card.mjs, общий attackId) не должны обе списать Реакцию.
  describe("attackId — одна Реакция на одно Действие", () => {
    it("вторая Реакция с тем же attackId блокируется, даже если пул ещё не пуст", async () => {
      globalThis.game.combat = { started: true };
      const actor = actorFor({ reactions: { value: 2, max: 2, defenseValue: 0, defenseMax: 0 } });
      expect(await spendReaction(actor, { forDefense: true, attackId: "atk-1" })).toBe(true);
      expect(actor.system.reactions.value).toBe(1); // первая реально списалась
      expect(canSpendReaction(actor, { forDefense: true, attackId: "atk-1" })).toBe(false);
      expect(await spendReaction(actor, { forDefense: true, attackId: "atk-1" })).toBe(false);
      expect(actor.system.reactions.value).toBe(1); // вторая — не списалась
    });

    it("другой attackId (следующая атака) — Реакция снова доступна", async () => {
      globalThis.game.combat = { started: true };
      const actor = actorFor({ reactions: { value: 2, max: 2, defenseValue: 0, defenseMax: 0 } });
      expect(await spendReaction(actor, { forDefense: true, attackId: "atk-1" })).toBe(true);
      expect(await spendReaction(actor, { forDefense: true, attackId: "atk-2" })).toBe(true);
      expect(actor.system.reactions.value).toBe(0);
    });

    it("без attackId (общая ручная трата) гейт не применяется вовсе", async () => {
      globalThis.game.combat = { started: true };
      const actor = actorFor({ reactions: { value: 2, max: 2, defenseValue: 0, defenseMax: 0 } });
      expect(await spendReaction(actor)).toBe(true);
      expect(await spendReaction(actor)).toBe(true);
      expect(actor.system.reactions.value).toBe(0);
    });

    it("список отработавших attackId гасится сбросом экономики (начало следующего своего Хода)", async () => {
      globalThis.game.combat = { started: true };
      const actor = actorFor({ reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
      await spendReaction(actor, { forDefense: true, attackId: "atk-1" });
      await resetActionEconomy(actor);
      expect(actor.getFlag("warhammer-dbc", "reactedAttackIds")).toBeUndefined();
      expect(canSpendReaction(actor, { forDefense: true, attackId: "atk-1" })).toBe(true);
    });
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

// Калечащее (стр. 168, wdbc-r5o7.5): «оба ОД в Ход ушли на физические
// действия» → непоглощаемый урон каждой раны из system.crippledWounds,
// раньше только кнопкой в чате (жать вручную), теперь — автоматически по
// накоплению physicalApSpentThisTurn до effectiveActionPointsMax.
describe("spendActionPoints({physical:true}) — авто-триггер Калечащего", () => {
  const withWound = (over = {}) => actorFor({
    actionPoints: { value: 2, max: 2 },
    crippledWounds: [{ location: "leftLeg", locationLabel: "Левая нога", rating: 3, damageType: "impact" }],
    wounds: { value: 5, max: 20 },
    ...over
  });

  it("одной физ. траты на весь max ОД хватает — триггерит сразу", async () => {
    globalThis.game.combat = { started: true };
    captured.chat = [];
    const actor = withWound();
    expect(await spendActionPoints(actor, 2, { physical: true })).toBe(true);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Калечащее");
    expect(actor.system.wounds.value).toBe(2); // 5 − рейтинг 3 (непоглощаемый урон)
  });

  it("две физ. траты по 1 ОД — триггерит только когда накопилось до max", async () => {
    globalThis.game.combat = { started: true };
    captured.chat = [];
    const actor = withWound({ actionPoints: { value: 2, max: 2 } });
    expect(await spendActionPoints(actor, 1, { physical: true })).toBe(true);
    expect(captured.chat).toHaveLength(0); // 1 из 2 — ещё не оба ОД
    expect(await spendActionPoints(actor, 1, { physical: true })).toBe(true);
    expect(captured.chat).toHaveLength(1); // второй физ. ОД — оба набраны
  });

  it("не физическая трата не засчитывается в счётчик", async () => {
    globalThis.game.combat = { started: true };
    captured.chat = [];
    const actor = withWound({ actionPoints: { value: 2, max: 2 } });
    expect(await spendActionPoints(actor, 1)).toBe(true); // без {physical:true}
    expect(await spendActionPoints(actor, 1, { physical: true })).toBe(true);
    expect(captured.chat).toHaveLength(0); // только 1 физ. ОД засчитан из 2
  });

  it("нет незаживших ран Калечащего — ничего не триггерит", async () => {
    globalThis.game.combat = { started: true };
    captured.chat = [];
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, wounds: { value: 5, max: 20 } });
    expect(await spendActionPoints(actor, 2, { physical: true })).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("уже триггерилось в этом Ходу — повторно не триггерит на следующей физ. трате", async () => {
    globalThis.game.combat = { started: true };
    captured.chat = [];
    const actor = withWound({ actionPoints: { value: 2, max: 2 } });
    await spendActionPoints(actor, 2, { physical: true });
    expect(captured.chat).toHaveLength(1);
    await actor.update({ "system.actionPoints.value": 2 }); // ещё Ход, ОД не сброшены руками
    await spendActionPoints(actor, 2, { physical: true });
    expect(captured.chat).toHaveLength(1); // не второй раз
  });

  it("несколько ран Калечащего — триггерит урон по каждой", async () => {
    globalThis.game.combat = { started: true };
    captured.chat = [];
    const actor = withWound({
      actionPoints: { value: 2, max: 2 },
      crippledWounds: [
        { location: "leftLeg",  locationLabel: "Левая нога",  rating: 3, damageType: "impact" },
        { location: "rightArm", locationLabel: "Правая рука", rating: 2, damageType: "impact" }
      ]
    });
    await spendActionPoints(actor, 2, { physical: true });
    expect(captured.chat).toHaveLength(2);
    expect(actor.system.wounds.value).toBe(0); // 5 − 3 − 2
  });

  it("resetActionEconomy снимает оба флага — новый Ход триггерит заново", async () => {
    const actor = withWound({ actionPoints: { value: 0, max: 2 } });
    await actor.setFlag("warhammer-dbc", "physicalApSpentThisTurn", 2);
    await actor.setFlag("warhammer-dbc", "cripplingTriggeredThisTurn", true);
    await resetActionEconomy(actor);
    expect(actor.getFlag("warhammer-dbc", "physicalApSpentThisTurn")).toBeUndefined();
    expect(actor.getFlag("warhammer-dbc", "cripplingTriggeredThisTurn")).toBeUndefined();
  });

  it("вне активного Encounter физ. трата не списывает ОД и не триггерит", async () => {
    captured.chat = [];
    const actor = withWound();
    expect(await spendActionPoints(actor, 2, { physical: true })).toBe(true);
    expect(captured.chat).toHaveLength(0);
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

  it("Техника — ничего не постит (нет экономики действий)", async () => {
    captured.chat = [];
    const actor = actorFor({ type: "vehicle" });
    await postTurnStartCard(actor);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("Прицеливание (wdbc-1rno.5): любое ненулевое действие тратит его впустую", () => {
  it("spendActionPoints с ненулевой ценой сбрасывает актора-стрелка system.aiming='half'", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, aiming: "half" });
    await spendActionPoints(actor, 1);
    expect(actor.system.aiming).toBe("none");
  });

  it("spendActionPoints с cost=0 НЕ трогает Прицеливание (формальные вызовы не должны стирать чужое)", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, aiming: "full" });
    await spendActionPoints(actor, 0);
    expect(actor.system.aiming).toBe("full");
  });

  it("spendReaction (Уклонение/Парирование) тоже сбрасывает Прицеливание", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 }, aiming: "half" });
    await spendReaction(actor, { forDefense: true });
    expect(actor.system.aiming).toBe("none");
  });

  it("не хватило ОД — spendActionPoints вернул false, Прицеливание не тронуто", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 0, max: 2 }, aiming: "half" });
    expect(await spendActionPoints(actor, 1)).toBe(false);
    expect(actor.system.aiming).toBe("half");
  });
});

describe("applyAimFocusTurnEnd (wdbc-1rno.5): продление Фокуса на Прицеле — «до конца его следующего Хода»", () => {
  it("нет флага — no-op", async () => {
    const actor = actorFor({ aiming: "half" });
    await applyAimFocusTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBeUndefined();
    expect(actor.system.aiming).toBe("half");
  });

  it("\"pending\" (объявлено только что) — первый конец Хода переводит в \"armed\", aiming не трогает", async () => {
    const actor = actorFor({ aiming: "half" });
    await actor.setFlag("warhammer-dbc", "aimFocusExtended", "pending");
    await applyAimFocusTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBe("armed");
    expect(actor.system.aiming).toBe("half");
  });

  it("\"armed\" (пережило один конец Хода) — второй конец Хода снимает флаг И aiming", async () => {
    const actor = actorFor({ aiming: "full" });
    await actor.setFlag("warhammer-dbc", "aimFocusExtended", "armed");
    await applyAimFocusTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBeUndefined();
    expect(actor.system.aiming).toBe("none");
  });

  it("два конца Хода подряд от \"pending\": первый — armed, второй — снято", async () => {
    const actor = actorFor({ aiming: "half" });
    await actor.setFlag("warhammer-dbc", "aimFocusExtended", "pending");
    await applyAimFocusTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBe("armed");
    await applyAimFocusTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBeUndefined();
    expect(actor.system.aiming).toBe("none");
  });

  it("нет актора — не падает", async () => {
    await expect(applyAimFocusTurnEnd(null)).resolves.toBeUndefined();
  });
});

// wdbc-x1nz.2.87 («Раны и Урон» → «Статусы»): Оглушённый/в Ступоре/Без
// сознания «не может совершать Действия и Реакции» — В ЛЮБОЙ момент, а не
// только с начала своего следующего Хода (resetActionEconomy). Состояние,
// наложенное посреди Раунда, должно сразу гасить остаток ОД и Реакцию.
describe("Оглушение/Ступор/Без сознания посреди Раунда (wdbc-x1nz.2.87)", () => {
  for (const [key, label] of [["stunned", "Оглушён"], ["dazed", "в Ступоре"], ["unconscious", "Без сознания"]]) {
    it(`${label}: Реакция (Уклонение/Парирование) запрещена, хотя пул не пуст`, async () => {
      globalThis.game.combat = { started: true };
      const actor = actorFor({ conditions: { [key]: true }, reactions: { value: 1, max: 1, defenseValue: 1, defenseMax: 1 } });
      expect(canSpendReaction(actor, { forDefense: true, attackId: "a1" })).toBe(false);
      expect(await spendReaction(actor, { forDefense: true, attackId: "a1" })).toBe(false);
      expect(actor.system.reactions.value).toBe(1);
      expect(actor.system.reactions.defenseValue).toBe(1);
    });

    it(`${label}: остаток ОД в собственном Ходу не тратится`, async () => {
      globalThis.game.combat = { started: true };
      const actor = actorFor({ conditions: { [key]: true }, actionPoints: { value: 2, max: 2 } });
      expect(canSpendActionPoints(actor, 1)).toBe(false);
      expect(await spendActionPoints(actor, 1)).toBe(false);
      // И не-физическое действие тоже: запрет на ВСЕ Действия, не только Физические.
      expect(await spendActionPoints(actor, 1, { physical: false })).toBe(false);
      expect(actor.system.actionPoints.value).toBe(2);
    });
  }

  it("отказ — с понятной причиной в уведомлении и в подсказке кнопки", async () => {
    globalThis.game.combat = { started: true };
    captured.warnings = [];
    const actor = actorFor({ conditions: { stunned: true } });
    actor.name = "Громила";
    await spendReaction(actor);
    expect(captured.warnings.join(" ")).toMatch(/Громила.*Оглушён/);
    expect(apSpendGate(actor, 1)).toEqual({ disabled: true, title: expect.stringMatching(/Оглушён/) });
    expect(reactionSpendGate(actor)).toEqual({ disabled: true, title: expect.stringMatching(/Оглушён/) });
  });

  it("вне Encounter (экономика выключена) — не гейтится, как и раньше", async () => {
    globalThis.game.combat = { started: false };
    const actor = actorFor({ conditions: { stunned: true, unconscious: true } });
    expect(canSpendActionPoints(actor, 2)).toBe(true);
    expect(canSpendReaction(actor)).toBe(true);
  });

  it("Сбитый с ног/Подавленный — не запрещают (запрет только у трёх Состояний книги)", () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ conditions: { prone: true, pinned: true } });
    expect(canSpendActionPoints(actor, 1)).toBe(true);
    expect(canSpendReaction(actor)).toBe(true);
  });
});

// wdbc-x1nz.2.88 п.1 («Статусы»): «Беспомощный персонаж не может совершать
// Физические действия». Метка physical у точки траты: true — телесное, false —
// явно не-физическое (психосила, Командование, психический ритуал), не
// указано — считается физическим (по книге телесное почти всё).
describe("Беспомощный: только не-Физические действия (wdbc-x1nz.2.88)", () => {
  const helpless = (over = {}) => actorFor({ conditions: { helpless: true }, ...over });

  it("физическая трата ОД запрещена — явная и по умолчанию", async () => {
    globalThis.game.combat = { started: true };
    const actor = helpless();
    expect(canSpendActionPoints(actor, 1, { physical: true })).toBe(false);
    expect(canSpendActionPoints(actor, 1)).toBe(false);
    expect(await spendActionPoints(actor, 1, { physical: true })).toBe(false);
    expect(await spendActionPoints(actor, 1)).toBe(false);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("не-физическое действие (physical:false) — разрешено и списывает ОД", async () => {
    globalThis.game.combat = { started: true };
    const actor = helpless();
    expect(canSpendActionPoints(actor, 2, { physical: false })).toBe(true);
    expect(await spendActionPoints(actor, 2, { physical: false })).toBe(true);
    expect(actor.system.actionPoints.value).toBe(0);
  });

  it("Реакция (Уклонение/Парирование — телесные) запрещена; не-физическая — разрешена", async () => {
    globalThis.game.combat = { started: true };
    const actor = helpless();
    expect(canSpendReaction(actor, { forDefense: true })).toBe(false);
    expect(await spendReaction(actor, { forDefense: true })).toBe(false);
    expect(actor.system.reactions.value).toBe(1);
    expect(canSpendReaction(actor, { physical: false })).toBe(true);
  });

  it("гейт кнопки говорит «Беспомощен» до клика; не-физическая кнопка не гейтится", () => {
    globalThis.game.combat = { started: true };
    const actor = helpless();
    expect(apSpendGate(actor, 1).title).toMatch(/Беспомощ/);
    expect(apSpendGate(actor, 1, { physical: false })).toEqual({ disabled: false, title: "" });
    expect(reactionSpendGate(actor).title).toMatch(/Беспомощ/);
  });

  it("Без сознания (даёт производное helpless) — запрещено даже не-физическое", () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ conditions: { unconscious: true, helpless: true } });
    expect(canSpendActionPoints(actor, 1, { physical: false })).toBe(false);
  });

  it("не-физическая трата без helpless не считается в Калечащее (метка тройная)", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await spendActionPoints(actor, 1);
    expect(actor.getFlag("warhammer-dbc", "physicalApSpentThisTurn")).toBeUndefined();
  });
});

describe("Реакции Орды — только в свой Ход («Орды», Действия)", () => {
  it("в чужой Ход Реакцию не тратит, в свой — тратит", async () => {
    const actor = actorFor({ type: "horde", reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.other" } } };
    expect(canSpendReaction(actor)).toBe(false);
    globalThis.game.combat = { started: true, combatant: { actor } };
    expect(canSpendReaction(actor)).toBe(true);
  });
});
