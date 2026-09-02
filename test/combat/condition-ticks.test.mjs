// test/combat/condition-ticks.test.mjs
//
// wdbc-j3yf: тик Состояний по Ходам. Поля длительности (sheet-helpers.mjs::
// CONDITIONS_DEF) уже существовали и писались с разных мест листа, но ни один
// хук их не читал — счётчики уменьшал и урон Кровотечения/Горения наносил
// игрок сам. Проверяется чистая механика тика, без Foundry-хука updateCombat.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { processConditionTurnStart, processConditionTurnEnd, rollBurningPanicTest } from "../../module/combat/condition-ticks.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor(overrides = {}) {
  const updates = [];
  const actor = {
    name: "Подставной",
    items: [],
    updates,
    system: {
      characteristics: { t: { bonus: 0, total: 40 }, wp: { bonus: 0 } },
      fatigue: { value: 0 },
      wounds: { value: 5, max: 10, critical: 0, firstAidUsed: true },
      conditions: {},
      ...overrides
    },
    getFlag: () => undefined,
    setFlag: async () => {},
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = actor;
        for (const part of parts.slice(0, -1)) target = (target[part] ??= {});
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("processConditionTurnStart: декремент длительности", () => {
  it("Оглушение 3 → 2, состояние остаётся, карточка с числами", async () => {
    const actor = makeActor({ conditions: { stunned: true, stunnedRounds: 3 } });
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.stunnedRounds).toBe(2);
    expect(actor.system.conditions.stunned).toBe(true);
    expect(captured.chat[0].content).toContain("Оглушение: <b>3</b> → <b>2</b>");
  });

  it("Оглушение 1 → 0 снимает состояние и пишет «снято»", async () => {
    const actor = makeActor({ conditions: { stunned: true, stunnedRounds: 1 } });
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.stunnedRounds).toBe(0);
    expect(actor.system.conditions.stunned).toBe(false);
    expect(captured.chat[0].content).toContain("снято");
  });

  it("Ослепление и Удушье тикают независимо друг от друга и от Оглушения", async () => {
    const actor = makeActor({ conditions: {
      blinded: true, blindedRounds: 2,
      suffocating: true, suffocatingRounds: 5
    } });
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.blindedRounds).toBe(1);
    expect(actor.system.conditions.suffocatingRounds).toBe(4);
    const content = captured.chat[0].content;
    expect(content).toContain("Ослепление");
    expect(content).toContain("Удушье");
  });

  it("без активных состояний — ни update, ни карточки", async () => {
    const actor = makeActor();
    await processConditionTurnStart(actor);
    expect(actor.updates).toHaveLength(0);
    expect(captured.chat).toHaveLength(0);
  });

  it("Кровотечение не тикает тут — это дело processConditionTurnEnd", async () => {
    const actor = makeActor({ conditions: { bleeding: true } });
    await processConditionTurnStart(actor);
    expect(actor.updates).toHaveLength(0);
    expect(captured.chat).toHaveLength(0);
  });

  it("Горение запускает Панику от Горения (wdbc-zepq) — успех ничего не меняет", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.system.characteristics.wp = { bonus: 0, total: 40 };
    actor.system.actionPoints = { value: 2, max: 2 };
    captured.dice = [30]; // 30 <= 40 → успех
    await processConditionTurnStart(actor);

    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.chat[0].content).toContain("Паника от Горения");
    expect(captured.chat[0].content).toContain("держит себя в руках");
  });

  it("Горение: провал теста Паники обнуляет ОД (Ход потерян)", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.system.characteristics.wp = { bonus: 0, total: 20 };
    actor.system.actionPoints = { value: 2, max: 2 };
    captured.dice = [50]; // 50 > 20 → провал
    await processConditionTurnStart(actor);

    expect(actor.system.actionPoints.value).toBe(0);
    expect(captured.chat[0].content).toContain("Ход потерян в панике");
  });
});

describe("rollBurningPanicTest", () => {
  it("тест Морали: провал не отнимает ничего сверх ОД без Lord of the Exodites", async () => {
    const actor = makeActor();
    actor.system.characteristics.wp = { bonus: 0, total: 10 };
    actor.system.actionPoints = { value: 3, max: 3 };
    captured.dice = [90];
    const { success } = await rollBurningPanicTest(actor);
    expect(success).toBe(false);
    expect(actor.system.actionPoints.value).toBe(0);
  });
});

describe("processConditionTurnEnd: Кровотечение", () => {
  it("бросок 1-5 (после вычета Обескровливания) — +1 уровень", async () => {
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 0 } });
    captured.dice = [3];
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.haemorrhagingLevel).toBe(1);
    expect(actor.system.conditions.haemorrhaging).toBe(true);
    expect(captured.chat[0].content).toContain("+1 Обескровливание");
  });

  it("бросок ≤0 после вычета — смерть, без изменения уровня", async () => {
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 2 } });
    captured.dice = [1]; // 1 - 2 = -1
    await processConditionTurnEnd(actor);

    expect(actor.updates).toHaveLength(0);
    expect(captured.chat[0].content).toContain("СМЕРТЬ");
  });

  it("бросок 6-10 после вычета — обошлось, без изменений", async () => {
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 0 } });
    captured.dice = [8];
    await processConditionTurnEnd(actor);

    expect(actor.updates).toHaveLength(0);
    expect(captured.chat[0].content).toContain("обошлось");
  });

  it("текущий уровень Обескровливания вычитается из броска", async () => {
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 4 } });
    captured.dice = [9]; // 9 - 4 = 5 → всё ещё в 1-5
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.haemorrhagingLevel).toBe(5);
  });

  it("нет Кровотечения — тишина", async () => {
    const actor = makeActor();
    await processConditionTurnEnd(actor);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("processConditionTurnEnd: возможности Саркофага Дредноута (wdbc-drn)", () => {
  const saved = getRuleSources();
  const grant = flag => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: flag }] }
    ]);
  };
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("immuneBleedingFatigue — Кровотечение не наносит вреда и не бросает кубы", async () => {
    grant("sarcophagus.immuneBleedingFatigue");
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 3 } });
    await processConditionTurnEnd(actor);

    expect(actor.updates).toHaveLength(0);
    expect(captured.rolls).toHaveLength(0); // не брошен даже 1d10
    expect(captured.chat[0].content).toContain("иммунитет саркофага");
  });

  it("без возможности Кровотечение работает как обычно", async () => {
    clearRuleSources();
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 0 } });
    captured.dice = [3];
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.haemorrhagingLevel).toBe(1);
  });

  it("autoWakeFromStun — снимает Оглушение целиком в конце Хода", async () => {
    grant("sarcophagus.autoWakeFromStun");
    const actor = makeActor({ conditions: { stunned: true, stunnedRounds: 5 } });
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.stunned).toBe(false);
    expect(actor.system.conditions.stunnedRounds).toBe(0);
    expect(captured.chat[0].content).toContain("Электрошок саркофага снял Оглушение");
  });

  it("autoWakeFromStun не снимает Оглушение, вызванное Галлюцинациями", async () => {
    grant("sarcophagus.autoWakeFromStun");
    const actor = makeActor({ conditions: { stunned: true, stunnedRounds: 2, hallucinogenic: true } });
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.stunned).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("без возможности Оглушение остаётся до конца Хода", async () => {
    clearRuleSources();
    const actor = makeActor({ conditions: { stunned: true, stunnedRounds: 2 } });
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.stunned).toBe(true);
    expect(actor.updates).toHaveLength(0);
  });
});

describe("processConditionTurnEnd: Горение", () => {
  it("урон проходит T.b — Раны падают, Усталость +1", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.system.characteristics.t.bonus = 2;
    captured.dice = [6]; // 6 - 2 = 4 урона
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(1); // 5 - 4
    expect(actor.system.fatigue.value).toBe(1);
    expect(captured.chat[0].content).toContain("4</b> урона");
  });

  it("урон целиком в T.b и тест T+0 провален — только Усталость", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.system.characteristics.t.bonus = 5;
    actor.system.characteristics.t.total = 30;
    captured.dice = [3, 50]; // 3-5<=0 → тест T+0: d100=50 > 30 → провал
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(5); // не изменилось
    expect(actor.system.fatigue.value).toBe(1);
    expect(captured.chat[0].content).toContain("провал");
  });

  it("урон целиком в T.b и тест T+0 пройден — ничего не меняется", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.system.characteristics.t.bonus = 5;
    actor.system.characteristics.t.total = 60;
    captured.dice = [3, 20]; // тест T+0: d100=20 <= 60 → успех
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(5);
    expect(actor.system.fatigue.value).toBe(0);
    expect(captured.chat[0].content).toContain("успех");
  });

  it("нет Горения — тишина", async () => {
    const actor = makeActor();
    await processConditionTurnEnd(actor);
    expect(captured.chat).toHaveLength(0);
  });
});
