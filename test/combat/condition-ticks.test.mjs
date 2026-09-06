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
  const flags = {};
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
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
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

  // Галлюцинации (стр. 168, wdbc-r5o7.8): раньше counter не был заведён в
  // CONDITIONS_DEF вовсе — Раунды из теста T-10X тихо терялись, decay здесь
  // не срабатывал. Теперь counter:"rounds" ставит его в общий цикл, тем же
  // приёмом, что Оглушение/Ослепление (не Удушье — то особый случай выше).
  it("Галлюцинации тикают и снимаются на 0, как Оглушение/Ослепление", async () => {
    const actor = makeActor({ conditions: { hallucinogenic: true, hallucinogenicRounds: 1 } });
    await processConditionTurnStart(actor);
    expect(actor.system.conditions.hallucinogenicRounds).toBe(0);
    expect(actor.system.conditions.hallucinogenic).toBe(false);
    expect(captured.chat[0].content).toContain("Галлюцинации");
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

// Удушье (стр. 30-31, wdbc-r5o7.6): особый случай среди «N раундов» — запас
// (suffocatingRounds) кончается 0, а не «состояние снято» (в отличие от
// Оглушения/Ослепления выше): на нуле начинаются тесты T+0, тег остаётся.
describe("processConditionTurnStart: Удушье — особый случай (не снимается на 0)", () => {
  it("запас 1 → 0 — тег НЕ снимается, дальше сразу тест (не общий приём цикла)", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 1 } });
    actor.system.characteristics.t.total = 60;
    captured.dice = [20]; // тест T+0: 20 <= 60 → успех
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.suffocatingRounds).toBe(0);
    expect(actor.system.conditions.suffocating).toBe(true); // НЕ false, в отличие от Оглушения
    expect(captured.chat[0].content).toContain("запас кончился");
  });

  it("запас уже 0 — тест T+0 каждый Ход, провал даёт +1 Усталости", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 0 } });
    actor.system.characteristics.t.total = 30;
    captured.dice = [50]; // 50 > 30 → провал
    await processConditionTurnStart(actor);

    expect(actor.system.fatigue.value).toBe(1);
    expect(actor.system.conditions.suffocating).toBe(true);
    expect(captured.chat[0].content).toContain("провал");
  });

  it("запас уже 0, тест пройден — Усталость не растёт", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 0 } });
    actor.system.characteristics.t.total = 60;
    captured.dice = [20]; // успех
    await processConditionTurnStart(actor);

    expect(actor.system.fatigue.value).toBe(0);
    expect(captured.chat[0].content).toContain("успех");
  });

  it("не Задыхается — тишина (не запускает тест просто так)", async () => {
    const actor = makeActor();
    await processConditionTurnStart(actor);
    expect(captured.chat).toHaveLength(0);
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

// Радиация (стр. 30-31, wdbc-r5o7.6): фиксированный 1 урон в T за Раунд (не
// бросок, в отличие от Горения), доза (radiationLevel) растёт тем же тактом;
// на кратных 10 — тест T+0, провал ставит флаг radiationSickness (лечится
// отдельно, combat/radiation.mjs).
describe("processConditionTurnEnd: Радиация", () => {
  it("фикс. 1 урон в T (Мод. характеристики), доза +1, ниже порога — без теста", async () => {
    const actor = makeActor({ conditions: { radiation: true, radiationLevel: 3 } });
    await processConditionTurnEnd(actor);

    expect(actor.system.charDamage.t).toBe(-1);
    expect(actor.system.conditions.radiationLevel).toBe(4);
    expect(captured.chat[0].content).not.toContain("тест T+0");
  });

  it("доза достигла кратного 10 — тест T+0, провал ставит флаг лучевой болезни", async () => {
    const actor = makeActor({ conditions: { radiation: true, radiationLevel: 9 } });
    actor.system.characteristics.t.total = 30;
    captured.dice = [50]; // d100 = 50 > 30 → провал
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.radiationLevel).toBe(10);
    expect(actor.getFlag("warhammer-dbc", "radiationSickness")).toBe(true);
    expect(captured.chat[0].content).toContain("провал");
  });

  it("доза достигла кратного 10, тест пройден — флага нет", async () => {
    const actor = makeActor({ conditions: { radiation: true, radiationLevel: 9 } });
    actor.system.characteristics.t.total = 60;
    captured.dice = [20]; // d100 = 20 <= 60 → успех
    await processConditionTurnEnd(actor);

    expect(actor.getFlag("warhammer-dbc", "radiationSickness")).toBeUndefined();
    expect(captured.chat[0].content).toContain("успех");
  });

  it("накопленный урон складывается (Мод. уже отрицательный)", async () => {
    const actor = makeActor({ conditions: { radiation: true, radiationLevel: 0 } });
    actor.system.charDamage = { t: -4 };
    await processConditionTurnEnd(actor);
    expect(actor.system.charDamage.t).toBe(-5);
  });

  it("нет Радиации — тишина", async () => {
    const actor = makeActor();
    await processConditionTurnEnd(actor);
    expect(captured.chat).toHaveLength(0);
  });
});

// ── wdbc-uqco: срок ведёт Duration, свой декремент ему не нужен ─────────────
// Состояние, у которого срок задан штатной Duration эффекта, из цикла ручного
// декремента выпадает целиком: иначе остаток уменьшался бы дважды за Ход —
// один раз подметанием, другой руками.
describe("processConditionTurnStart: Состояния со сроком Duration", () => {
  /** Актор с эффектом-носителем срока: ровно то, что читает подметание. */
  function actorWithDuration(key, duration, conditions) {
    const actor = makeActor({ conditions });
    const fx = {
      statuses: [key], duration,
      flags: { "warhammer-dbc": { conditionDuration: key } },
      getFlag: (scope, k) => fx.flags?.[scope]?.[k],
      async delete() { actor.effects = actor.effects.filter(e => e !== fx); }
    };
    actor.effects = [fx];
    return actor;
  }

  beforeEach(() => {
    globalThis.game.combat = { id: "c1", round: 5, turn: 0 };
    globalThis.game.time = { worldTime: 0 };
  });

  it("не уменьшает счётчик руками — его уже пересчитало ядро", async () => {
    // duration.remaining ядро считает само (Foundry v14); наше дело — зеркало.
    const actor = actorWithDuration("stunned", { value: 4, units: "rounds", remaining: 2 },
      { stunned: true, stunnedRounds: 4 });

    await processConditionTurnStart(actor);

    expect(actor.system.conditions.stunnedRounds).toBe(2);
    expect(captured.chat[0]?.content ?? "").not.toContain("Оглушение: <b>4</b>");
  });

  it("истёкший срок снимает эффект и говорит об этом в карточке", async () => {
    const actor = actorWithDuration("stunned", { value: 2, units: "rounds", remaining: 0 },
      { stunned: true, stunnedRounds: 1 });

    await processConditionTurnStart(actor);

    expect(actor.effects).toEqual([]);
    expect(captured.chat[0].content).toContain("Оглушение: срок вышел — снято");
  });

  it("Состояние БЕЗ эффекта-срока тикает руками, как и раньше", async () => {
    const actor = actorWithDuration("stunned", { value: 9, units: "rounds", remaining: 9 },
      { stunned: true, stunnedRounds: 3, blinded: true, blindedRounds: 3 });

    await processConditionTurnStart(actor);

    expect(actor.system.conditions.blindedRounds).toBe(2);
  });
});
