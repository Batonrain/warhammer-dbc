// test/combat/drug-withdrawal.test.mjs
//
// wdbc-gyqf2, часть 3. Обвязка зависимости от наркотика: отсчёт частоты приёма,
// часы Календаря (карточка на границе периода, урон «в начале периода»), тест
// на срыв (–50, +10 за период, раз за период), штраф без дозы как правило для
// броска. Чистая арифметика — test/rules/drug-withdrawal.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { drugWithdrawalClock, startWithdrawal, endWithdrawal } from "../../module/combat/drug-withdrawal.mjs";
import { CONDITION_CLOCK_HANDLERS } from "../../module/combat/condition-clock.mjs";
import { rollBreakTest, weeklyDoseCheck, removeDrugAddiction, resolveDrug } from "../../module/sheets/tabs/drugs.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { getRuleSources } from "../../module/rules/sources.mjs";

const H = 3600, D = 86400, NS = "warhammer-dbc";
const T0 = 500 * D;

// Зависимость хранится флагом АКТОРА (task-9717), а не полем предмета; isAddicted на
// предмете — устаревшее, оставлено false, чтобы тесты не опирались на него.
function drug({ id = "d1", name = "Тиск", add = {} } = {}) {
  const item = {
    id, name, type: "drug",
    system: { addiction: { hasAddiction: true, isAddicted: false, minDose: 2, testChar: "t", testMod: 10, frequency: "1 день", ...add } },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let cur = item;
        for (const p of parts.slice(0, -1)) cur = cur[p];
        cur[parts.at(-1)] = value;
      }
    }
  };
  return item;
}

function actor(items = [], { t = 40, wp = 35, flags = {} } = {}) {
  const a = {
    name: "Ходок", items, flags: { [NS]: flags },
    system: {
      characteristics: { t: { total: t, bonus: 4 }, wp: { total: wp, bonus: 3 }, per: { total: 40, bonus: 4 }, fel: { total: 40, bonus: 4 } },
      charLoss: { per: 0, wp: 0, t: 0 }, charLossAt: {}, conditions: {}, fatigue: { value: 0 }, wounds: { value: 10, max: 10, critical: 0 }
    },
    getFlag: (_s, k) => a.flags[NS][k],
    setFlag: async (_s, k, v) => { a.flags[NS][k] = foundry.utils.mergeObject(a.flags[NS][k] ?? {}, v, { inplace: false }); },
    update: async d => {
      for (const [p, v] of Object.entries(d)) {
        const m = p.match(/^system\.charLoss\.(\w+)$/);
        if (m) a.system.charLoss[m[1]] = v;
      }
    }
  };
  return a;
}

const entry = a => a.flags[NS].drugWithdrawal;
/** Зависимость «как после миграции»: запись есть, метки дозы ещё нет. */
const addictedNoDose = (a, item) => {
  a.flags[NS].drugWithdrawal = { ...(a.flags[NS].drugWithdrawal ?? {}),
    [item.name]: { addicted: true, name: item.name, addiction: JSON.parse(JSON.stringify(item.system.addiction)), lastDose: null, doneTo: 0, tested: 0 } };
};

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: T0 };
});

describe("часы зависимости", () => {
  it("стоят в списке часов Состояний", () => {
    expect(CONDITION_CLOCK_HANDLERS.map(h => h.id)).toContain("drugWithdrawal");
  });

  it("метки дозы нет — отсчёт с КОНЦА отрезка: штрафа задним числом нет, теста с бонусом +230 тоже", async () => {
    const a = actor([drug()]);
    addictedNoDose(a, a.items[0]);
    await drugWithdrawalClock(a, { from: T0, to: T0 + 30 * D });
    expect(entry(a)["Тиск"]).toMatchObject({ addicted: true, lastDose: T0 + 30 * D, doneTo: T0 + 30 * D, tested: 0 });
    expect(captured.chat).toHaveLength(0);
    globalThis.game.time.worldTime = T0 + 30 * D;
    expect(await rollBreakTest(a, a.items[0])).toBeNull();   // период ещё не закончился
  });

  it("доза, введённая другим персонажем, снимает штраф получателя (зависимость — на нём самом)", async () => {
    const mine = drug();
    const a = actor([mine]);
    await startWithdrawal(a, mine, T0);
    globalThis.game.time.worldTime = T0 + 3 * D;
    const medicsItem = drug({ add: { minDose: 0 } });                        // предмет колющего: на нём зависимости нет
    await weeklyDoseCheck(a, medicsItem);
    expect(entry(a)["Тиск"]).toMatchObject({ addicted: true, lastDose: T0 + 3 * D, doneTo: T0 + 3 * D, tested: 0 });
    expect(medicsItem.system.addiction.isAddicted).toBe(false);              // чужой предмет не тронут
  });

  it("недельный тест не пропускается из-за зависимости ХОЗЯИНА предмета: решает флаг получателя", async () => {
    const medicsItem = drug({ name: "Рекаф", add: { minDose: 1, testMod: -30 } });
    medicsItem.system.addiction.isAddicted = true;                           // у колющего зависимость стояла бы в предмете
    const patient = actor([], { t: 40 });
    captured.nextRoll = 90;
    await weeklyDoseCheck(patient, medicsItem);
    expect(entry(patient)["Рекаф"]).toMatchObject({ addicted: true });       // тест был, получатель зависим
  });

  it("зависимый получатель недельным тестом не перебрасывается", async () => {
    const item = drug({ name: "Рекаф", add: { minDose: 1, testMod: -30 } });
    const a = actor([], { t: 40 });
    addictedNoDose(a, item);
    captured.nextRoll = 90;
    await weeklyDoseCheck(a, item);
    expect(captured.chat).toHaveLength(0);
    expect(entry(a)["Рекаф"]).toMatchObject({ addicted: true, lastDose: T0 });
  });

  it("удалённый пустой флакон не снимает ни штраф, ни часы: настройки берутся из снимка записи", async () => {
    const flask = drug({ add: { penaltyMods: "basedon:wp=-30", penalty: "−30 на тесты W" } });
    const a = actor([flask]);
    await startWithdrawal(a, flask, T0);
    a.items.length = 0;                                                      // флакон кончился и удалён
    globalThis.game.time.worldTime = T0 + D;
    expect(resolveTest({ actor: a, kind: "char", char: "wp" }).autoMods[0]?.value).toBe(-30);
    await drugWithdrawalClock(a, { from: T0, to: T0 + D });
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("начался штраф");
    expect(captured.chat[0].content).toContain("Тиск");
  });

  it("зависимость от удалённого препарата: тест на срыв и ручное снятие работают по ключу", async () => {
    const flask = drug({ add: { testMod: 50 } });
    const a = actor([flask], { t: 40 });
    await startWithdrawal(a, flask, T0);
    a.items.length = 0;
    globalThis.game.time.worldTime = T0 + 4 * D;                              // 3 периода: –30, Порог 40+50–30 = 60
    captured.nextRoll = 55;
    const res = await rollBreakTest(a, resolveDrug(a, "Тиск"));
    expect(res).toMatchObject({ success: true, cured: true });
    expect(entry(a)["Тиск"]).toBeNull();
  });

  it("две стопки одного препарата — одна зависимость: снятие стирает счёт целиком", async () => {
    const s1 = drug({ id: "s1" }), s2 = drug({ id: "s2" });
    const a = actor([s1, s2]);
    await startWithdrawal(a, s1, T0);
    expect(Object.keys(entry(a))).toEqual(["Тиск"]);
    await endWithdrawal(a, s2);
    expect(entry(a)["Тиск"]).toBeNull();
  });

  it("не зависим или нет частоты — часы молчат", async () => {
    const a = actor([drug(), drug({ id: "d2", name: "Без частоты", add: { frequency: "" } })]);
    await startWithdrawal(a, a.items[1], T0);                                // зависим, но периода нет
    await drugWithdrawalClock(a, { from: T0, to: T0 + 30 * D });             // от Тиска зависимости нет вовсе
    expect(captured.chat).toHaveLength(0);
  });

  it("частота вышла — карточка «начался штраф»; один раз, повторный сдвиг и откат её не повторяют", async () => {
    const a = actor([drug({ add: { penaltyMods: "basedon:wp=-30", penalty: "−30 на тесты W" } })]);
    await startWithdrawal(a, a.items[0], T0);
    await drugWithdrawalClock(a, { from: T0, to: T0 + D });
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("начался штраф");
    expect(captured.chat[0].content).toContain("−30 на тесты W");
    await drugWithdrawalClock(a, { from: T0, to: T0 + D });                 // тот же отрезок ещё раз
    await drugWithdrawalClock(a, { from: T0 - 5 * D, to: T0 + D - 1 });    // Календарь откатили и вернули
    expect(captured.chat).toHaveLength(1);
  });

  it("прыжок на несколько периодов — все границы в одной карточке: тест открывается с –50, затем –40", async () => {
    const a = actor([drug()]);
    await startWithdrawal(a, a.items[0], T0);
    await drugWithdrawalClock(a, { from: T0, to: T0 + 3 * D });
    expect(captured.chat).toHaveLength(1);
    const c = captured.chat[0].content;
    expect(c).toContain("начался штраф");
    expect(c).toContain("1-й период под штрафом закончился");
    expect(c).toContain("−50");
    expect(c).toContain("2-й период под штрафом закончился");
    expect(c).toContain("−40");
  });

  it("доп. модификатор срыва (Смах –20) входит в подсказку теста", async () => {
    const a = actor([drug({ name: "Смах", add: { breakMod: -20 } })]);
    await startWithdrawal(a, a.items[0], T0);
    await drugWithdrawalClock(a, { from: T0, to: T0 + 2 * D });
    expect(captured.chat[0].content).toContain("−70");
  });

  it("урон в Характеристику «в начале каждого периода» (Тиск 1d5–1 в P): по границе, не по таймеру", async () => {
    captured.nextRoll = 3;
    const a = actor([drug({ add: { periodCharDamage: { stat: "per", formula: "1d5-1" } } })]);
    await startWithdrawal(a, a.items[0], T0);
    await drugWithdrawalClock(a, { from: T0, to: T0 + D - 1 });
    expect(a.system.charLoss.per).toBe(0);                                   // период ещё не начался
    await drugWithdrawalClock(a, { from: T0 + D - 1, to: T0 + 3 * D });      // границы 1, 2, 3
    expect(a.system.charLoss.per).toBe(9);                                   // 3 × (заглушка 3)
    expect(captured.chat.at(-1).content).toContain("урон в");
  });

  it("новая доза обнуляет счёт: прежние границы больше не бьют", async () => {
    const a = actor([drug()]);
    await startWithdrawal(a, a.items[0], T0);
    await startWithdrawal(a, a.items[0], T0 + 20 * H);                       // принял в срок
    await drugWithdrawalClock(a, { from: T0 + 20 * H, to: T0 + D + H });     // 21 ч после новой дозы — ещё не вышло
    expect(captured.chat).toHaveLength(0);
  });

  it("мёртвому границы не рассчитываются в урон", async () => {
    const a = actor([drug({ add: { periodCharDamage: { stat: "per", formula: "1d5" } } })]);
    await startWithdrawal(a, a.items[0], T0);
    a.flags[NS].deceased = true;
    await drugWithdrawalClock(a, { from: T0, to: T0 + 2 * D });
    expect(a.system.charLoss.per).toBe(0);
  });
});

describe("тест на срыв зависимости (кнопка «Тест» зависимого)", () => {
  it("пока период под штрафом не закончился — предупреждение, броска нет", async () => {
    const item = drug();
    const a = actor([item]);
    await startWithdrawal(a, item, T0);
    globalThis.game.time.worldTime = T0 + D + H;                              // идёт 1-й период
    captured.nextRoll = 50;
    const res = await rollBreakTest(a, item);
    expect(res).toBeNull();
    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings.join(" ")).toMatch(/недоступен/);
  });

  it("после 1-го периода: –50 к Пределу; провал — зависимость остаётся, второй попытки на период нет", async () => {
    const item = drug();                                                     // T 40, мод +10
    const a = actor([item], { t: 40 });
    await startWithdrawal(a, item, T0);
    globalThis.game.time.worldTime = T0 + 2 * D;
    captured.nextRoll = 60;                                                   // Порог 40+10−50 = 0 → провал
    const res = await rollBreakTest(a, item);
    expect(res).toMatchObject({ success: false, cured: false });
    expect(captured.chat[0].content).toContain("<label>Порог</label><b>0</b>");
    expect(entry(a)["Тиск"]).toMatchObject({ addicted: true, tested: 1 });
    captured.chat.length = 0; captured.warnings.length = 0;
    expect(await rollBreakTest(a, item)).toBeNull();                          // тот же период
    expect(captured.warnings.join(" ")).toMatch(/уже был/);
  });

  it("после 3-го периода: –30 (–50 +10 за 2 предыдущих); успех снимает зависимость и запись", async () => {
    const item = drug({ add: { testMod: 50 } });                              // T 40+50−30 = 60
    const a = actor([item], { t: 40 });
    await startWithdrawal(a, item, T0);
    globalThis.game.time.worldTime = T0 + 4 * D;                              // 3 периода закончились
    captured.nextRoll = 55;
    const res = await rollBreakTest(a, item);
    expect(res).toMatchObject({ success: true, cured: true });
    expect(captured.chat[0].content).toContain("<label>Порог</label><b>60</b>");
    expect(entry(a)["Тиск"]).toBeNull();
  });

  it("Смах: breakMod –20 уходит в Порог", async () => {
    const item = drug({ add: { testMod: 60, breakMod: -20 } });               // 40+60−50−20 = 30
    const a = actor([item], { t: 40 });
    await startWithdrawal(a, item, T0);
    globalThis.game.time.worldTime = T0 + 2 * D;
    captured.nextRoll = 99;
    await rollBreakTest(a, item);
    expect(captured.chat[0].content).toContain("<label>Порог</label><b>30</b>");
  });

  it("комбинированный: Порог — наименьший из двух, оба со штрафом срыва", async () => {
    const item = drug({ name: "Рекаф", add: { testChar: "t", testMod: 40, testChar2: "wp", testMod2: 50 } });
    const a = actor([item], { t: 40, wp: 20 });                              // T 40+40−50 = 30; W 20+50−50 = 20
    await startWithdrawal(a, item, T0);
    globalThis.game.time.worldTime = T0 + 2 * D;
    captured.nextRoll = 99;
    await rollBreakTest(a, item);
    const c = captured.chat[0].content;
    expect(c).toContain("<label>Порог</label><b>20</b>");
    expect(c).toContain("Комбинированный тест");
  });

  it("ручное снятие зависимости стирает запись отсчёта", async () => {
    const item = drug();
    const a = actor([item]);
    await startWithdrawal(a, item, T0);
    await removeDrugAddiction(a, item);
    expect(entry(a)["Тиск"]).toBeNull();
    await endWithdrawal(a, item);                                            // повтор безопасен
  });
});

describe("доза и тест Зависимости", () => {
  it("доза зависимого сбрасывает отсчёт: штраф и периоды обнулены", async () => {
    const item = drug({ add: { minDose: 0 } });
    const a = actor([item]);
    await startWithdrawal(a, item, T0);
    globalThis.game.time.worldTime = T0 + 5 * D;
    await weeklyDoseCheck(a, item);
    expect(entry(a)["Тиск"]).toMatchObject({ addicted: true, lastDose: T0 + 5 * D, doneTo: T0 + 5 * D, tested: 0 });
  });

  it("комбинированный тест на лимите доз: Предел = наименьший (T 40+40=80, W 30+50=80 → при W 20 → 70)", async () => {
    const item = drug({ name: "Рекаф", addicted: false, add: { minDose: 1, testChar: "t", testMod: 40, testChar2: "wp", testMod2: 50 } });
    const a = actor([item], { t: 40, wp: 20 });
    captured.nextRoll = 50;
    await weeklyDoseCheck(a, item);
    const c = captured.chat[0].content;
    expect(c).toContain("<label>Порог</label><b>70</b>");
    expect(c).toContain("Комбинированный тест");
  });

  it("новая зависимость начинает отсчёт с момента провала теста", async () => {
    const item = drug({ name: "Рекаф", addicted: false, add: { minDose: 1, testChar: "t", testMod: -30 } });
    const a = actor([item], { t: 40 });
    a.flags[NS].drugWithdrawal = { "Рекаф": { lastDose: 1, doneTo: 1, tested: 3 } };   // остаток прошлой зависимости
    captured.nextRoll = 90;
    await weeklyDoseCheck(a, item);
    expect(item.system.addiction.isAddicted).toBe(false);                    // предмет не трогается
    expect(entry(a)["Рекаф"]).toMatchObject({ addicted: true, lastDose: T0, doneTo: T0, tested: 0 });
  });
});

describe("штраф без дозы как правило броска", () => {
  const social = { target: "social" };
  it("источник зарегистрирован", () => {
    expect(getRuleSources().map(([k]) => k)).toContain("drugWithdrawal");
  });

  it("пока доза просрочена — автоматический модификатор в Пороге; в срок — нет", () => {
    const item = drug({ name: "Призрак", add: { frequency: "9 часов", penaltyMods: "social=-10" } });
    const a = actor([item]);
    a.flags[NS].drugWithdrawal = { "Призрак": { addicted: true, lastDose: T0, doneTo: T0, tested: 0 } };
    const ctx = { actor: a, kind: "skill", skill: "charm", char: "fel" };
    globalThis.game.time.worldTime = T0 + 9 * H - 1;
    expect(resolveTest(ctx).autoMods).toEqual([]);
    globalThis.game.time.worldTime = T0 + 9 * H;
    const mods = resolveTest(ctx).autoMods;
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({ value: -10 });
    expect(mods[0].label).toContain("Призрак");
    // Не социальный Навык — штраф не касается.
    expect(resolveTest({ ...ctx, skill: "awareness", char: "per" }).autoMods).toEqual([]);
    expect(social.target).toBe("social");
  });

  it("«на все тесты T»: бьёт тест Навыка на Стойкости и голый тест T, не Ловкость", () => {
    const item = drug({ name: "Стимм", add: { penaltyMods: "basedon:t=-20" } });
    const a = actor([item]);
    a.flags[NS].drugWithdrawal = { "Стимм": { addicted: true, lastDose: T0, doneTo: T0, tested: 0 } };
    globalThis.game.time.worldTime = T0 + 2 * D;
    expect(resolveTest({ actor: a, kind: "skill", skill: "survival", char: "t" }).autoMods[0]?.value).toBe(-20);
    expect(resolveTest({ actor: a, kind: "char", char: "t" }).autoMods[0]?.value).toBe(-20);
    expect(resolveTest({ actor: a, kind: "char", char: "ag" }).autoMods).toEqual([]);
  });
});
