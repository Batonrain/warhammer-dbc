// test/combat/condition-ticks.test.mjs
//
// wdbc-j3yf: тик Состояний по Ходам. Поля длительности (sheet-helpers.mjs::
// CONDITIONS_DEF) уже существовали и писались с разных мест листа, но ни один
// хук их не читал — счётчики уменьшал и урон Кровотечения/Горения наносил
// игрок сам. Проверяется чистая механика тика, без Foundry-хука updateCombat.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

const completeInfection = vi.fn(async () => {});
vi.mock("../../module/apps/parasite-trait.mjs", () => ({
  completeInfection: (...args) => completeInfection(...args)
}));

import {
  processConditionTurnStart, processConditionTurnEnd, rollBurningPanicTest,
  suffocationRestClock, setSuffocationRestMode, haemorrhageHourly, wakeFromHaemorrhageOnDamage
} from "../../module/combat/condition-ticks.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { BLESSED_FITS_PENDING_FLAG } from "../../module/rules/blessed-fits.mjs";

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

beforeEach(() => { resetCaptured(); completeInfection.mockClear(); });

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

  // Blessed Fits/Благословенные Припадки (wdbc-1rno, Общие Мутации):
  // Оглушение от переброшенного провала естественно доходит до 0 — «провёл
  // полный Раунд» — Очко Бесчестия возвращается тем же тактом.
  describe("Blessed Fits/Благословенные Припадки (wdbc-1rno)", () => {
    function withFateActor(overrides = {}) {
      return makeActor({
        alignment: "heretic", fate: { value: 5 },
        characteristics: { t: { bonus: 0, total: 40 }, wp: { bonus: 0 }, inf: { bonus: 10 } },
        conditions: { stunned: true, stunnedRounds: 1 },
        ...overrides
      });
    }

    it("метка стоит, Оглушение 1 → 0 — Очко возвращается, метка снимается", async () => {
      const actor = withFateActor();
      await actor.setFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG, true);
      await processConditionTurnStart(actor);

      expect(actor.system.conditions.stunned).toBe(false);
      expect(actor.system.fate.value).toBe(6); // 5 + 1
      expect(actor.getFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG)).toBeUndefined();
      expect(captured.chat[0].content).toContain("вернулось");
    });

    it("без метки — обычный декремент, Очко не трогается", async () => {
      const actor = withFateActor();
      await processConditionTurnStart(actor);

      expect(actor.system.fate.value).toBe(5);
      expect(captured.chat[0].content).not.toContain("Благословенные Припадки");
    });

    it("метка стоит, но Оглушение ещё НЕ на 0 (было 2) — рано, Очко не трогается", async () => {
      const actor = withFateActor({ conditions: { stunned: true, stunnedRounds: 2 } });
      await actor.setFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG, true);
      await processConditionTurnStart(actor);

      expect(actor.system.conditions.stunnedRounds).toBe(1);
      expect(actor.system.fate.value).toBe(5);
      expect(actor.getFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG)).toBe(true); // метка ещё ждёт
    });

    it("Оглушения нет вовсе (снято раньше срока) — метка просто повисает без возврата", async () => {
      const actor = withFateActor({ conditions: {} });
      await actor.setFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG, true);
      await processConditionTurnStart(actor);

      expect(actor.system.fate.value).toBe(5);
      expect(actor.getFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG)).toBe(true);
    });
  });

  // Parasite/Паразит (Трейт, wdbc-ux8a): контакт дотикал до 0 — completeInfection
  // зовётся тем же тактом, что возврат Очка Бесчестия у Blessed Fits выше.
  describe("Parasite/Паразит: parasiticContact → 0 зовёт completeInfection", () => {
    it("1 → 0 — снимает счётчик и зовёт completeInfection", async () => {
      const actor = makeActor({ conditions: { parasiticContact: true, parasiticContactRounds: 1 } });
      await processConditionTurnStart(actor);

      expect(actor.system.conditions.parasiticContactRounds).toBe(0);
      expect(actor.system.conditions.parasiticContact).toBe(false);
      expect(completeInfection).toHaveBeenCalledWith(actor);
    });

    it("3 → 2 — рано, completeInfection не зовётся", async () => {
      const actor = makeActor({ conditions: { parasiticContact: true, parasiticContactRounds: 3 } });
      await processConditionTurnStart(actor);

      expect(actor.system.conditions.parasiticContactRounds).toBe(2);
      expect(completeInfection).not.toHaveBeenCalled();
    });
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

// Удушье (книга, «Раны и Урон» → «Удушье», wdbc-x1nz.2.94). Прежние тесты
// здесь закрепляли неверное толкование (wdbc-r5o7.6): пока запас есть — без
// тестов, после — тесты бесконечно, ни потери сознания, ни смерти. Книга:
// «При задерживании дыхания персонаж должен проходить тест на Т+0 каждую
// минуту или каждый Ход… Если персонаж не получил свежего вздоха за
// отведенное время, он теряет сознание. Потерявший сознание персонаж умирает
// от удушья через T.b Раундов».
describe("processConditionTurnStart: Удушье по книге (wdbc-x1nz.2.94)", () => {
  it("во время задержки — тест T+0 каждый Ход, провал даёт +1 Усталости, запас тает", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 5 } });
    actor.system.characteristics.t.total = 30;
    captured.dice = [50]; // 50 > 30 → провал
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.suffocatingRounds).toBe(4);
    expect(actor.system.fatigue.value).toBe(1);
    expect(actor.system.conditions.unconscious).toBeFalsy();
    expect(captured.chat[0].content).toContain("провал");
  });

  it("во время задержки тест пройден — Усталость не растёт", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 5 } });
    actor.system.characteristics.t.total = 60;
    captured.dice = [20];
    await processConditionTurnStart(actor);

    expect(actor.system.fatigue.value).toBe(0);
    expect(captured.chat[0].content).toContain("успех");
  });

  it("запас 1 → 0 — теряет сознание, тег остаётся, запускается отсчёт T.b Раундов", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 1 } });
    actor.system.characteristics.t = { bonus: 3, total: 60 };
    captured.dice = [20];
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.suffocatingRounds).toBe(0);
    expect(actor.system.conditions.suffocating).toBe(true); // НЕ false, в отличие от Оглушения
    expect(actor.system.conditions.unconscious).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "suffocation")).toEqual({ phase: "unconscious", left: 3, faintAt: null });
    expect(captured.chat[0].content).toContain("Без сознания");
  });

  it("без сознания — T.b Раундов до смерти, затем killByCondition", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 0, unconscious: true } });
    await actor.setFlag("warhammer-dbc", "suffocation", { phase: "unconscious", left: 2 });

    await processConditionTurnStart(actor);
    expect(actor.getFlag("warhammer-dbc", "suffocation").left).toBe(1);
    expect(actor.getFlag("warhammer-dbc", "deceased")).toBeFalsy();

    await processConditionTurnStart(actor);
    expect(actor.getFlag("warhammer-dbc", "deceased")).toBe(true);
    expect(captured.chat.at(-1).content).toContain("СМЕРТЬ");
    expect(captured.rolls).toHaveLength(0); // без сознания тестов T+0 нет
  });

  it("наложено без числа (запас 0, задержка не начата) — полный запас T.b×2, а не сразу тесты без конца", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 0 } });
    actor.system.characteristics.t = { bonus: 4, total: 60 };
    captured.dice = [20];
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.suffocatingRounds).toBe(7); // 4×2 − 1 за этот Ход
    expect(actor.system.conditions.unconscious).toBeFalsy();
    expect(captured.chat[0].content).toContain("запас <b>8</b>");
  });

  it("тег снят (вздохнул) — отсчёт смерти сбрасывается", async () => {
    const actor = makeActor({ conditions: { suffocating: false, unconscious: true } });
    await actor.setFlag("warhammer-dbc", "suffocation", { phase: "unconscious", left: 2 });
    await processConditionTurnStart(actor);

    expect(actor.getFlag("warhammer-dbc", "suffocation")).toBeUndefined();
    expect(captured.chat[0].content).toContain("вздохнул");
  });

  it("режим «в покое» — Ходы задержку не трогают (её ведут минуты игрового времени)", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 3 } });
    await actor.setFlag("warhammer-dbc", "suffocationRest", true);
    await processConditionTurnStart(actor);

    expect(actor.system.conditions.suffocatingRounds).toBe(3);
    expect(captured.rolls).toHaveLength(0);
  });

  it("тест T+0 — с модификаторами персонажа из реестра правил", async () => {
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [{ id: "test.tpen", when: {},
      effects: [{ kind: "rollBonus", target: "all", value: -15, label: "Обескровливание", auto: true }] }]);
    try {
      const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 5 } });
      actor.system.characteristics.t.total = 40;
      captured.dice = [30]; // 30 ≤ 40, но > 40−15=25 → провал
      await processConditionTurnStart(actor);
      expect(actor.system.fatigue.value).toBe(1);
      expect(captured.chat[0].content).toContain(">25</b>");
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("не Задыхается — тишина (не запускает тест просто так)", async () => {
    const actor = makeActor();
    await processConditionTurnStart(actor);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("Удушье в покое: минуты игрового времени (suffocationRestClock)", () => {
  it("тест T+0 каждую полную минуту, запас в минутах; кончился — Без сознания, T.b Раундов спустя — смерть", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 2 } });
    actor.system.characteristics.t = { bonus: 2, total: 60 };
    await actor.setFlag("warhammer-dbc", "suffocationRest", true);
    await actor.setFlag("warhammer-dbc", "suffocationClockAt", 1000);
    captured.dice = [10, 10];

    await suffocationRestClock(actor, { from: 1000, to: 1000 + 60 * 2 + 30 });

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(actor.system.conditions.unconscious).toBe(true);
    // Без сознания на 1120 с; T.b 2 Раунда = 10 с — к 1150 уже прошло.
    expect(actor.getFlag("warhammer-dbc", "deceased")).toBe(true);
  });

  it("меньше минуты — ничего не бросается", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 2 } });
    await actor.setFlag("warhammer-dbc", "suffocationRest", true);
    await actor.setFlag("warhammer-dbc", "suffocationClockAt", 1000);
    await suffocationRestClock(actor, { from: 1000, to: 1030 });
    expect(captured.rolls).toHaveLength(0);
    expect(actor.system.conditions.suffocatingRounds).toBe(2);
  });

  it("переключение режима пересчитывает остаток той же долей запаса", async () => {
    const actor = makeActor({ conditions: { suffocating: true, suffocatingRounds: 4 } });
    actor.system.characteristics.t.bonus = 4; // активный запас 8 Раундов, в покое 4 минуты
    globalThis.game.time = { worldTime: 500 };
    await setSuffocationRestMode(actor, true);
    expect(actor.system.conditions.suffocatingRounds).toBe(2); // половина из 4 минут
    expect(actor.getFlag("warhammer-dbc", "suffocationClockAt")).toBe(500);
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
    // wdbc-x1nz.2.92: не только строка в чате — смерть констатирована.
    expect(actor.getFlag("warhammer-dbc", "deceased")).toBe(true);
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

// Обескровливание выше предела (wdbc-x1nz.2.92): «больше 5 (10 для
// десантников), раз в минуту (12 Ходов), начиная с Хода, когда он пересек
// этот предел — тест W+0, или теряет сознание, пока его Обескровливание не
// опустится ниже, или пока он не получит непоглощенный урон».
describe("processConditionTurnEnd: предел Обескровливания", () => {
  function bled(level, wpTotal = 30) {
    const actor = makeActor({ conditions: { haemorrhaging: true, haemorrhagingLevel: level } });
    actor.system.characteristics.wp = { bonus: 3, total: wpTotal };
    return actor;
  }

  it("Ход пересечения предела — тест W+0, провал: Без сознания с меткой «от Обескровливания»", async () => {
    const actor = bled(6);
    captured.dice = [80]; // 80 > 30
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.unconscious).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "haemorrhageFaint")).toBe(true);
    expect(captured.chat[0].content).toContain("от Обескровливания");
  });

  it("следующий тест — только через 12 Ходов", async () => {
    const actor = bled(6);
    captured.dice = [10]; // успех на Ходу пересечения
    await processConditionTurnEnd(actor);
    for (let i = 1; i < 12; i++) await processConditionTurnEnd(actor);
    expect(captured.rolls).toHaveLength(1);
    captured.dice = [10];
    await processConditionTurnEnd(actor); // 12-й Ход после пересечения
    expect(captured.rolls).toHaveLength(2);
  });

  it("уровень 5 — не больше предела, теста нет", async () => {
    const actor = bled(5);
    await processConditionTurnEnd(actor);
    expect(captured.rolls).toHaveLength(0);
  });

  it("десантнику предел 10: уровень 8 теста не требует", async () => {
    const actor = bled(8);
    actor.system.race = "astartes";
    await processConditionTurnEnd(actor);
    expect(captured.rolls).toHaveLength(0);
  });

  it("уровень опустился до предела — очнулся, метка снята", async () => {
    const actor = bled(5);
    actor.system.conditions.unconscious = true;
    await actor.setFlag("warhammer-dbc", "haemorrhageFaint", true);
    await processConditionTurnEnd(actor);
    expect(actor.system.conditions.unconscious).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "haemorrhageFaint")).toBeUndefined();
  });

  it("непоглощённый урон будит (зовётся из конвейера урона)", async () => {
    const actor = bled(7);
    actor.system.conditions.unconscious = true;
    await actor.setFlag("warhammer-dbc", "haemorrhageFaint", true);
    expect(await wakeFromHaemorrhageOnDamage(actor)).toBe(true);
    expect(actor.system.conditions.unconscious).toBe(false);
  });

  it("не будит того, кого держит Усталость на пороге", async () => {
    const actor = bled(7);
    actor.system.characteristics.t.bonus = 2; // порог T.b+W.b = 5
    actor.system.fatigue.value = 5;
    actor.system.conditions.unconscious = true;
    await actor.setFlag("warhammer-dbc", "haemorrhageFaint", true);
    await wakeFromHaemorrhageOnDamage(actor);
    expect(actor.system.conditions.unconscious).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "haemorrhageFaint")).toBeUndefined();
  });

  it("чужое Без сознания (без метки) урон от Обескровливания не снимает", async () => {
    const actor = bled(7);
    actor.system.conditions.unconscious = true;
    expect(await wakeFromHaemorrhageOnDamage(actor)).toBe(false);
    expect(actor.system.conditions.unconscious).toBe(true);
  });
});

describe("haemorrhageHourly: −1 Обескровливания в час игрового времени", () => {
  it("прошло 3 часа — уровень −3, отсчёт сдвинут на целые часы, ниже предела — очнулся", async () => {
    const actor = makeActor({ conditions: { haemorrhaging: true, haemorrhagingLevel: 7, unconscious: true } });
    await actor.setFlag("warhammer-dbc", "haemorrhageHourAt", 1000);
    await actor.setFlag("warhammer-dbc", "haemorrhageFaint", true);
    await haemorrhageHourly(actor, { from: 1000, to: 1000 + 3 * 3600 + 100 });

    expect(actor.system.conditions.haemorrhagingLevel).toBe(4);
    expect(actor.getFlag("warhammer-dbc", "haemorrhageHourAt")).toBe(1000 + 3 * 3600);
    expect(actor.system.conditions.unconscious).toBe(false);
  });

  it("меньше часа — уровень не меняется", async () => {
    const actor = makeActor({ conditions: { haemorrhaging: true, haemorrhagingLevel: 2 } });
    await actor.setFlag("warhammer-dbc", "haemorrhageHourAt", 1000);
    await haemorrhageHourly(actor, { from: 1000, to: 1000 + 3000 });
    expect(actor.system.conditions.haemorrhagingLevel).toBe(2);
  });

  it("сошло до 0 — Состояние снято, отсчёт убран", async () => {
    const actor = makeActor({ conditions: { haemorrhaging: true, haemorrhagingLevel: 1 } });
    await haemorrhageHourly(actor, { from: 0, to: 7200 });
    expect(actor.system.conditions.haemorrhagingLevel).toBe(0);
    expect(actor.system.conditions.haemorrhaging).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "haemorrhageHourAt")).toBeUndefined();
  });

  it("тик Кровотечения с 0 до 1 ставит начало часового отсчёта", async () => {
    globalThis.game.time = { worldTime: 4242 };
    const actor = makeActor({ conditions: { bleeding: true, haemorrhagingLevel: 0 } });
    captured.dice = [3];
    await processConditionTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "haemorrhageHourAt")).toBe(4242);
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

  // Броня Огненного Дракона (wdbc-q0q8, ARMOR_PROPERTIES.fireproof) —
  // единственное известное исключение из «Горение игнорирует броню целиком»:
  // собственное AP ТЕЛА этого предмета, удвоенное, вычитается из тика.
  it("Fireproof (Броня Огненного Дракона): AP тела ×2 снижает урон Горения сверх T.b", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.items = [{
      type: "armor",
      system: { equipped: true, body: 8, properties: ["fireproof"] }
    }];
    // 10 - T.b(0) - AP(8*2=16) = 0 → урон не проходит вовсе
    captured.dice = [10, 20]; // второй бросок — тест T+0 запасной ветки
    actor.system.characteristics.t.total = 60;
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(5); // не изменилось
    expect(captured.chat[0].content).toContain("AP(×2) 16");
  });

  it("Fireproof: неэкипированная броня с этим свойством не считается", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    actor.items = [{
      type: "armor",
      system: { equipped: false, body: 8, properties: ["fireproof"] }
    }];
    captured.dice = [6]; // 6 - T.b(0) - AP(0, не учтена) = 6 урона, при 5 текущих Ранах — уходит в крит.
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(0);
    expect(actor.system.wounds.critical).toBe(1);
    expect(captured.chat[0].content).toContain("игнор брони");
  });

  // wdbc-x1nz.2.93: «некоторые источники пламени наносят больше урона» —
  // формула источника (Flame (2d10)) вместо жёсткого 1d10.
  it("формула источника пламени заменяет 1d10", async () => {
    const actor = makeActor({ conditions: { burning: true } });
    await actor.setFlag("warhammer-dbc", "burningDamageFormula", "2d10");
    captured.dice = [6, 5]; // 2d10 = 11, T.b 0
    await processConditionTurnEnd(actor);

    expect(captured.rolls[0]).toBe("2d10");
    expect(captured.chat[0].content).toContain("11</b> урона");
  });

  it("погасшее Горение сбрасывает формулу источника", async () => {
    const actor = makeActor({ conditions: { burning: false } });
    await actor.setFlag("warhammer-dbc", "burningDamageFormula", "2d10");
    await processConditionTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "burningDamageFormula")).toBeUndefined();
  });

  it("непоглощённый урон Горения будит лишившегося сознания от Обескровливания", async () => {
    const actor = makeActor({ conditions: { burning: true, unconscious: true } });
    await actor.setFlag("warhammer-dbc", "haemorrhageFaint", true);
    captured.dice = [3];
    await processConditionTurnEnd(actor);
    expect(actor.system.conditions.unconscious).toBe(false);
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
