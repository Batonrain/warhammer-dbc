// test/rules/kind-outcome.test.mjs
//
// resolveKindOutcome — вынесена из actor-sheet.mjs (_resolveKindOutcome) без
// изменений арифметики; test/sheets/skill-roll.test.mjs это уже подтверждает
// косвенно (через диалог), здесь — прямые проверки самой функции, потому что
// теперь её зовёт не только Навык/Характеристика.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
// kind-outcome.mjs строит подписи через helpers/utils.mjs::esc, а та зовёт
// foundry.utils.escapeHTML — заглушка нужна для загрузки, не для расчёта
// (см. шапку test/support/foundry-stub.mjs).
import "../support/foundry-stub.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const flags = {};
const actor = (over = {}) => ({
  system: { characteristics: {}, ...over },
  items: [],
  getFlag: (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]),
  setFlag: async (scope, key, value) => {
    flags[scope] ??= {};
    const parts = key.split(".");
    let node = flags[scope];
    for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
    node[parts.at(-1)] = value;
  }
});

beforeEach(() => { clearRuleSources(); for (const k in flags) delete flags[k]; });
afterEach(() => { clearRuleSources(); for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn); });

const ctx = a => ({ actor: a, kind: "skill", char: "wp" });

describe("resolveKindOutcome — base", () => {
  it("успех/степень как у testOutcome, без kindLabel", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 40, ctx: ctx(actor()) });
    expect(out).toMatchObject({ eff: 45, success: true, deg: 1, kindLabel: null });
  });

  it("autoSuccess засчитывает успех даже при формальном провале", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 20, rv: 80, ctx: ctx(actor()), autoSuccess: true });
    expect(out.success).toBe(true);
  });
});

describe("resolveKindOutcome — combined", () => {
  it("итоговый Порог — наименьший из двух, с подписью", async () => {
    const out = await resolveKindOutcome(actor(), {
      kind: "combined", baseEff: 45, rv: 25, ctx: ctx(actor()),
      combined: { charKey: "ag", target: 20 }
    });
    expect(out.eff).toBe(20);
    expect(out.success).toBe(false); // 25 > 20
    expect(out.combinedLine).toContain("итоговый Порог <b>20</b>");
  });
});

describe("resolveKindOutcome — extended", () => {
  it("успех копит банк на акторе, провал — нет", async () => {
    const a = actor();
    const s1 = await resolveKindOutcome(a, {
      kind: "extended", baseEff: 45, rv: 35, ctx: ctx(a), extended: { label: "Тест", goal: 10 }
    });
    expect(s1.extendedLine).toContain("Банк <b>2</b>/10");
    expect(a.getFlag("warhammer-dbc", "extendedTests.тест")).toEqual({ accumulated: 2, target: 10 });

    const s2 = await resolveKindOutcome(a, {
      kind: "extended", baseEff: 45, rv: 90, ctx: ctx(a), extended: { label: "Тест", goal: 10 }
    });
    expect(s2.extendedLine).toContain("+0");
    expect(a.getFlag("warhammer-dbc", "extendedTests.тест").accumulated).toBe(2);
  });

  it("достижение цели помечается ГОТОВО", async () => {
    const a = actor();
    await a.setFlag("warhammer-dbc", "extendedTests.тест", { accumulated: 9, target: 10 });
    const out = await resolveKindOutcome(a, {
      kind: "extended", baseEff: 45, rv: 10, ctx: ctx(a), extended: { label: "Тест", goal: 10 }
    });
    expect(out.extendedLine).toContain("ГОТОВО");
  });
});

describe("resolveKindOutcome — opposed", () => {
  it("побеждает атакующий с большей степенью", async () => {
    const out = await resolveKindOutcome(actor(), {
      kind: "opposed", baseEff: 45, rv: 20, ctx: ctx(actor()),
      opposed: { threshold: 40, roll: 35 }
    });
    expect(out.opposedLine).toMatch(/Вы побеждаете|Соперник побеждает/);
  });

  it("без данных соперника (opposed: null) — строки нет", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "opposed", baseEff: 45, rv: 20, ctx: ctx(actor()), opposed: null });
    expect(out.opposedLine).toBe("");
  });
});

// Egomania/Эгомания (wdbc-1rno, Слаанеш): «автоматически побеждает в любом
// встречном тесте против социальных взаимодействий» — здесь только
// bросающий (NPC-соперник — числа, не документ, свою Эгоманию проверить
// неоткуда, см. заголовок rules/egomania.mjs).
describe("resolveKindOutcome — opposed, Egomania (wdbc-1rno)", () => {
  const withEgomania = bearer => {
    clearRuleSources();
    registerRuleSource("test", a => a === bearer
      ? [{ id: "test.egomania", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.egomania" }] }]
      : []);
  };

  it("Дар + социальный Навык (charm) — побеждает, даже проиграв по степени", async () => {
    const bearer = actor();
    withEgomania(bearer);
    const out = await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 20, rv: 90, // провал моего броска
      ctx: { ...ctx(bearer), skill: "charm" },
      opposed: { threshold: 60, roll: 10 } // соперник уверенно выигрывает по цифрам
    });
    expect(out.opposedLine).toContain("Вы побеждаете");
  });

  it("Дар, но НЕсоциальный Навык (scrutiny) — обычный исход, без подмены", async () => {
    const bearer = actor();
    withEgomania(bearer);
    const out = await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 20, rv: 90,
      ctx: { ...ctx(bearer), skill: "scrutiny" },
      opposed: { threshold: 60, roll: 10 }
    });
    expect(out.opposedLine).toContain("Соперник побеждает");
  });

  it("без Дара — обычный исход социального Навыка, без подмены", async () => {
    clearRuleSources();
    const out = await resolveKindOutcome(actor(), {
      kind: "opposed", baseEff: 20, rv: 90,
      ctx: { ...ctx(actor()), skill: "charm" },
      opposed: { threshold: 60, roll: 10 }
    });
    expect(out.opposedLine).toContain("Соперник побеждает");
  });
});

// Personal Adaptation/Персональная Адаптация (wdbc-1rno, Тзинч): +5 к Порогу
// встречного теста против конкретной цели, растёт после КАЖДОГО такого
// теста (не только победы), капируется Cor.b, хранится флагом на бросающем.
describe("resolveKindOutcome — opposed, Personal Adaptation (wdbc-1rno)", () => {
  const withPersonalAdaptation = bearer => {
    clearRuleSources();
    registerRuleSource("test", a => a === bearer
      ? [{ id: "test.personalAdaptation", when: {}, effects: [{ kind: "grantFlag", target: "gift.tzeentch.personalAdaptation" }] }]
      : []);
  };
  const target = { uuid: "Actor.target", name: "Соперник" };

  afterEach(() => { delete globalThis.game.time; });

  it("без Дара — Порог не меняется, запись не пишется", async () => {
    clearRuleSources();
    const bearer = actor({ corruptionBonus: 3 });
    await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 40, rv: 50, ctx: { ...ctx(bearer), targetActor: target },
      opposed: { threshold: 40, roll: 50 }
    });
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")).toBeUndefined();
  });

  it("первый встречный тест против цели — записывает +5, следующий читает его в Пороге", async () => {
    const bearer = actor({ corruptionBonus: 3 }); // cap = ⌈3/2⌉×5 = 10
    withPersonalAdaptation(bearer);
    globalThis.game.time = { worldTime: 1000 };

    const first = await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 40, rv: 50, ctx: { ...ctx(bearer), targetActor: target },
      opposed: { threshold: 40, roll: 50 }
    });
    expect(first.personalAdaptationLine).toBe(""); // ещё нечего показывать — это первый тест
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")).toEqual([
      { targetUuid: "Actor.target", bonus: 5, expiresAt: 1000 + 9 * 365 * 86400 }
    ]);

    const second = await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 40, rv: 50, ctx: { ...ctx(bearer), targetActor: target },
      opposed: { threshold: 40, roll: 50 }
    });
    expect(second.eff).toBe(45); // 40 + 5 накопленных
    expect(second.personalAdaptationLine).toContain("+5");
    expect(second.personalAdaptationLine).toContain("Соперник");
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")[0].bonus).toBe(10); // 5+5, ещё не капировано (cap=10)
  });

  it("растёт даже при поражении («после КАЖДОГО», не только победы)", async () => {
    const bearer = actor({ corruptionBonus: 3 });
    withPersonalAdaptation(bearer);
    globalThis.game.time = { worldTime: 1000 };
    await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 20, rv: 90, ctx: { ...ctx(bearer), targetActor: target },
      opposed: { threshold: 60, roll: 10 } // соперник уверенно выигрывает
    });
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")[0].bonus).toBe(5);
  });

  it("капируется потолком по Cor.b — дальше не растёт", async () => {
    const bearer = actor({ corruptionBonus: 1 }); // cap = ⌈1/2⌉×5 = 5
    withPersonalAdaptation(bearer);
    globalThis.game.time = { worldTime: 1000 };
    await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 40, rv: 50, ctx: { ...ctx(bearer), targetActor: target },
      opposed: { threshold: 40, roll: 50 }
    });
    await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 40, rv: 50, ctx: { ...ctx(bearer), targetActor: target },
      opposed: { threshold: 40, roll: 50 }
    });
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")[0].bonus).toBe(5);
  });

  it("Дар, но нет цели (targetActor отсутствует) — не применяется и не пишется", async () => {
    const bearer = actor({ corruptionBonus: 3 });
    withPersonalAdaptation(bearer);
    globalThis.game.time = { worldTime: 1000 };
    const out = await resolveKindOutcome(bearer, {
      kind: "opposed", baseEff: 40, rv: 50, ctx: ctx(bearer),
      opposed: { threshold: 40, roll: 50 }
    });
    expect(out.personalAdaptationLine).toBe("");
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")).toBeUndefined();
  });

  it("не Встречный тест (base) — Дар не применяется, даже с целью в ctx", async () => {
    const bearer = actor({ corruptionBonus: 3 });
    withPersonalAdaptation(bearer);
    globalThis.game.time = { worldTime: 1000 };
    const out = await resolveKindOutcome(bearer, {
      kind: "base", baseEff: 40, rv: 50, ctx: { ...ctx(bearer), targetActor: target }
    });
    expect(out.eff).toBe(40);
    expect(bearer.getFlag("warhammer-dbc", "personalAdaptationBonuses")).toBeUndefined();
  });
});

describe("resolveKindOutcome — crit", () => {
  it("натуральный 1-5 — Критический Успех в строке", async () => {
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 3, ctx: ctx(actor()) });
    expect(out.critLine).toContain("Критический Успех");
  });

  it("правило critRangeMod расширяет диапазон", async () => {
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "critRangeMod", target: "char:wp", side: "success", value: 10 }]
    }]);
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 10, ctx: ctx(actor()) });
    expect(out.critLine).toContain("Критический Успех");
  });
});

describe("resolveKindOutcome — scriptTrigger (wdbc-1rno, Полимат/Библиотека Акаши)", () => {
  const skillCtx = a => ({ actor: a, kind: "skill", skill: "trade" });

  /** Предмет с одной записью kind:"script", тот же приём фикстур, что у test/apps/mechanics-script-throttle.test.mjs. */
  const scriptItem = (id, entry) => {
    const store = { "warhammer-dbc.mechanics": [{ id: "g1", operator: "AND", entries: [entry] }] };
    return {
      id, name: `Предмет ${id}`,
      getFlag: (scope, key) => store[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; return value; }
    };
  };

  it("Крит.Успех подходящей области — код записи выполняется", async () => {
    const entry = { id: "e1", kind: "script", scriptTrigger: "critSuccess", code: 'await item.setFlag("test","ran",true);' };
    const it1 = scriptItem("it1", entry);
    const a = actor(); a.items = [it1];
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "scriptTrigger", target: "skill:trade", side: "critSuccess", itemId: "it1", entryId: "e1" }]
    }]);
    await resolveKindOutcome(a, { kind: "base", baseEff: 45, rv: 3, ctx: skillCtx(a) }); // rv=3 -> натуральный Крит.Успех (1-5)
    expect(it1.getFlag("test", "ran")).toBe(true);
  });

  it("не Критический бросок — код не выполняется", async () => {
    const entry = { id: "e1", kind: "script", scriptTrigger: "critSuccess", code: 'await item.setFlag("test","ran",true);' };
    const it1 = scriptItem("it1", entry);
    const a = actor(); a.items = [it1];
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "scriptTrigger", target: "skill:trade", side: "critSuccess", itemId: "it1", entryId: "e1" }]
    }]);
    await resolveKindOutcome(a, { kind: "base", baseEff: 45, rv: 40, ctx: skillCtx(a) }); // не 1-5 и не 96-100
    expect(it1.getFlag("test", "ran")).toBeUndefined();
  });

  it("сторона не совпадает (ждём critFailure, вышел Крит.Успех) — не выполняется", async () => {
    const entry = { id: "e1", kind: "script", scriptTrigger: "critFailure", code: 'await item.setFlag("test","ran",true);' };
    const it1 = scriptItem("it1", entry);
    const a = actor(); a.items = [it1];
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "scriptTrigger", target: "skill:trade", side: "critFailure", itemId: "it1", entryId: "e1" }]
    }]);
    await resolveKindOutcome(a, { kind: "base", baseEff: 45, rv: 3, ctx: skillCtx(a) });
    expect(it1.getFlag("test", "ran")).toBeUndefined();
  });

  it("область не подходит — не выполняется", async () => {
    const entry = { id: "e1", kind: "script", scriptTrigger: "critSuccess", code: 'await item.setFlag("test","ran",true);' };
    const it1 = scriptItem("it1", entry);
    const a = actor(); a.items = [it1];
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "scriptTrigger", target: "skill:trade", side: "critSuccess", itemId: "it1", entryId: "e1" }]
    }]);
    // ctx() (объявлен выше в файле) — навык не "trade", область не совпадёт.
    await resolveKindOutcome(a, { kind: "base", baseEff: 45, rv: 3, ctx: ctx(a) });
    expect(it1.getFlag("test", "ran")).toBeUndefined();
  });

  it("throttle (scriptThrottleUnit) гейтит автозапуск так же, как ручную кнопку", async () => {
    globalThis.game.combat = { round: 1 };
    const entry = {
      id: "e1", kind: "script", scriptTrigger: "critSuccess", scriptThrottleUnit: "round",
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);'
    };
    const it1 = scriptItem("it1", entry);
    const a = actor(); a.items = [it1];
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "scriptTrigger", target: "skill:trade", side: "critSuccess", itemId: "it1", entryId: "e1" }]
    }]);
    await resolveKindOutcome(a, { kind: "base", baseEff: 45, rv: 3, ctx: skillCtx(a) });
    await resolveKindOutcome(a, { kind: "base", baseEff: 45, rv: 4, ctx: skillCtx(a) });
    expect(it1.getFlag("test", "count")).toBe(1);
    globalThis.game.combat = undefined;
  });
});

describe("resolveKindOutcome — failDegMod (wdbc-1rno, Sentient Cyst)", () => {
  const socialCtx = a => ({ actor: a, kind: "skill", skill: "charm" });

  it("провал: доп. Провалы из failDegMod прибавляются к степени", async () => {
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "failDegMod", target: "social", value: 3 }]
    }]);
    // rv=60 против Порога 45: провал на 15 -> базовая степень 2 (floor(15/10)+1).
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 60, ctx: socialCtx(actor()) });
    expect(out.success).toBe(false);
    expect(out.deg).toBe(5); // 2 + 3
  });

  it("успех: failDegMod не трогает степень вовсе", async () => {
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "failDegMod", target: "social", value: 3 }]
    }]);
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 30, ctx: socialCtx(actor()) });
    expect(out.success).toBe(true);
    expect(out.deg).toBe(2); // (45-30)/10+1, без +3
  });

  it("область не подходит (не социальный навык) — не применяется", async () => {
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "failDegMod", target: "social", value: 3 }]
    }]);
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 60, ctx: ctx(actor()) });
    expect(out.deg).toBe(2); // без +3 — ctx() не социальный навык
  });

  it("степень не уходит ниже 1, даже при отрицательном failDegMod", async () => {
    registerRuleSource("s", () => [{
      id: "r", effects: [{ kind: "failDegMod", target: "social", value: -99 }]
    }]);
    const out = await resolveKindOutcome(actor(), { kind: "base", baseEff: 45, rv: 60, ctx: socialCtx(actor()) });
    expect(out.deg).toBe(1);
  });
});
