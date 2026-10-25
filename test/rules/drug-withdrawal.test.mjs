// test/rules/drug-withdrawal.test.mjs
//
// wdbc-gyqf2, части 1 и 3. Корбук, «Наркотики: Зависимость»: поля 2-4 —
// «Тест Зависимости. Обычно T или W, или комбинированный тест обоих» (наименьший
// из Пределов, стр. 25); «Частота приема. Через какой максимальный период
// персонаж должен принимать наркотик»; «Эффект зависимости. Штраф … За каждый
// период частоты приема, что персонаж провел под действием штрафа, он может
// пройти Тест Зависимости со штрафом –50 и бонусом +10 за каждый предыдущий
// последовательный период, проведенный под штрафом. Если проходит — избавляется».
// Чистая логика, без Foundry.

import { describe, it, expect } from "vitest";
import {
  parseFrequency, addictionTestParts, lowestPart, parsePenaltyMods,
  withdrawalPeriodIndex, isUnderPenalty, completedPeriods, breakTestState, breakTestMod,
  periodBoundaries, withdrawalPenaltyRules, freshEntry, withdrawalStatusLabel, drugKey
} from "../../module/rules/drug-withdrawal.mjs";
import { doseKey } from "../../module/rules/drug-doses.mjs";

const H = 3600, D = 86400;

describe("частота приёма: текст → секунды", () => {
  it("часы и сутки в обеих записях — книжной и паковой", () => {
    expect(parseFrequency("8 часов")).toBe(8 * H);
    expect(parseFrequency("8ч")).toBe(8 * H);
    expect(parseFrequency("12 ч")).toBe(12 * H);
    expect(parseFrequency("9 часов")).toBe(9 * H);
    expect(parseFrequency("1 день")).toBe(D);
    expect(parseFrequency("3 дня")).toBe(3 * D);
    expect(parseFrequency("6 дней")).toBe(6 * D);
  });
  it("мусор и ноль — null: периода нет, часы молчат", () => {
    expect(parseFrequency("")).toBeNull();
    expect(parseFrequency(undefined)).toBeNull();
    expect(parseFrequency("часто")).toBeNull();
    expect(parseFrequency("0 дней")).toBeNull();
  });
});

describe("тест Зависимости: одна или две характеристики", () => {
  it("без второй — один Предел (прежнее поведение)", () => {
    expect(addictionTestParts({ testChar: "WP", testMod: -20 })).toEqual([{ charKey: "wp", mod: -20 }]);
    expect(addictionTestParts({})).toEqual([{ charKey: "t", mod: 0 }]);
  });
  it("со второй — комбинированный: оба слагаемых со своими модификаторами", () => {
    expect(addictionTestParts({ testChar: "t", testMod: 40, testChar2: "wp", testMod2: 50 }))
      .toEqual([{ charKey: "t", mod: 40 }, { charKey: "wp", mod: 50 }]);
  });
  it("бросок идёт против наименьшего Предела; при равенстве — первый", () => {
    expect(lowestPart([{ eff: 80 }, { eff: 85 }])).toBe(0);
    expect(lowestPart([{ eff: 90 }, { eff: 85 }])).toBe(1);
    expect(lowestPart([{ eff: 70 }, { eff: 70 }])).toBe(0);
  });
});

describe("периоды без дозы", () => {
  const last = 1000 * D, P = 8 * H;
  it("в срок — 0; с момента last+P идёт 1-й период под штрафом", () => {
    expect(withdrawalPeriodIndex(last, P, last + P - 1)).toBe(0);
    expect(withdrawalPeriodIndex(last, P, last + P)).toBe(1);
    expect(withdrawalPeriodIndex(last, P, last + 2 * P - 1)).toBe(1);
    expect(withdrawalPeriodIndex(last, P, last + 2 * P)).toBe(2);
  });
  it("часы Календаря назад — период не уходит в минус", () => {
    expect(withdrawalPeriodIndex(last, P, last - 5 * D)).toBe(0);
  });
  it("нет метки дозы или периода — штрафа нет", () => {
    expect(withdrawalPeriodIndex(null, P, last)).toBe(0);
    expect(withdrawalPeriodIndex(last, null, last + 99 * D)).toBe(0);
    expect(isUnderPenalty({ lastDose: last }, null, last + 99 * D)).toBe(false);
  });
  it("штраф — со 2-го момента периода (с last+P), закончено периодов — на один меньше номера", () => {
    const e = { lastDose: last, doneTo: last, tested: 0 };
    expect(isUnderPenalty(e, P, last + P - 1)).toBe(false);
    expect(isUnderPenalty(e, P, last + P)).toBe(true);
    expect(completedPeriods(e, P, last + P)).toBe(0);
    expect(completedPeriods(e, P, last + 2 * P)).toBe(1);
    expect(completedPeriods(e, P, last + 5 * P)).toBe(4);
  });
});

describe("тест на срыв зависимости: –50, +10 за каждый предыдущий период", () => {
  it("модификатор растёт на 10 за период; доп. модификатор (Смах –20) складывается", () => {
    expect(breakTestMod(1)).toBe(-50);
    expect(breakTestMod(2)).toBe(-40);
    expect(breakTestMod(5)).toBe(-10);
    expect(breakTestMod(1, -20)).toBe(-70);
  });
  it("доступен после завершённого периода, один раз на период", () => {
    const P = 24 * H, last = 500 * D;
    const e = { lastDose: last, doneTo: last, tested: 0 };
    expect(breakTestState(e, P, last + P).available).toBe(false);       // 1-й период ещё идёт
    expect(breakTestState(e, P, last + 2 * P)).toMatchObject({ completed: 1, available: true });
    const tried = { ...e, tested: 1 };
    expect(breakTestState(tried, P, last + 2 * P).available).toBe(false); // за этот период уже пробовал
    expect(breakTestState(tried, P, last + 3 * P)).toMatchObject({ completed: 2, available: true });
  });
  it("нет записи — теста нет", () => {
    expect(breakTestState(undefined, 24 * H, 5)).toMatchObject({ completed: 0, available: false });
  });
});

describe("границы периодов в отрезке Календаря", () => {
  const last = 100 * D, P = 12 * H;
  it("каждая граница last+j·P в (from, to], j ≥ 1", () => {
    const b = periodBoundaries({ lastDose: last }, P, last, last + 3 * P);
    expect(b.map(x => x.index)).toEqual([1, 2, 3]);
    expect(b[0].at).toBe(last + P);
  });
  it("не бьёт одну границу дважды и не берёт прошлое", () => {
    expect(periodBoundaries({ lastDose: last }, P, last + P, last + P + 1)).toEqual([]);
    expect(periodBoundaries({ lastDose: last }, P, last + P - 1, last + P).map(x => x.index)).toEqual([1]);
    expect(periodBoundaries({ lastDose: last }, P, last + 10 * P, last + 5 * P)).toEqual([]);
  });
  it("прыжок на годы не вешает цикл — предел числа границ", () => {
    expect(periodBoundaries({ lastDose: last }, 3600, last, last + 400 * D).length).toBeLessThanOrEqual(50);
  });
});

describe("нотация штрафа", () => {
  it("цель=значение через «;»; список целей через запятую → массив", () => {
    const { mods, errors } = parsePenaltyMods("basedon:s=-20; basedon:t=−20 ;social=-10; skill:charm,skill:command=-10");
    expect(errors).toEqual([]);
    expect(mods).toEqual([
      { target: "basedon:s", value: -20 },
      { target: "basedon:t", value: -20 },
      { target: "social", value: -10 },
      { target: ["skill:charm", "skill:command"], value: -10 }
    ]);
  });
  it("пусто — ничего; мусор попадает в errors и не рождает модификатор", () => {
    expect(parsePenaltyMods("")).toEqual({ mods: [], errors: [] });
    const r = parsePenaltyMods("basedon:s=много; =5; all");
    expect(r.mods).toEqual([]);
    expect(r.errors).toHaveLength(3);
  });
});

describe("правила штрафа: только пока доза просрочена", () => {
  const P = 8 * H, last = 300 * D;
  const drug = (extra = {}) => ({
    id: "d1", name: " Рекаф ", type: "drug",
    system: { addiction: { hasAddiction: true, isAddicted: true, frequency: "8 часов", penaltyMods: "social=-10", ...extra } }
  });
  const entries = { "Рекаф": { lastDose: last, doneTo: last, tested: 0 } };

  it("в срок — правил нет; просрочено — авто-модификатор к тестам", () => {
    expect(withdrawalPenaltyRules([drug()], entries, last + P - 1)).toEqual([]);
    const rules = withdrawalPenaltyRules([drug()], entries, last + P);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([expect.objectContaining({ kind: "rollBonus", target: "social", value: -10, auto: true })]);
    expect(rules[0].label).toContain("Рекаф");
  });
  it("не зависим, нет зависимости у препарата, нет метки дозы, нет штрафа в данных — правил нет", () => {
    const now = last + 3 * P;
    expect(withdrawalPenaltyRules([drug({ isAddicted: false })], entries, now)).toEqual([]);
    expect(withdrawalPenaltyRules([drug({ hasAddiction: false })], entries, now)).toEqual([]);
    expect(withdrawalPenaltyRules([drug()], {}, now)).toEqual([]);
    expect(withdrawalPenaltyRules([drug({ penaltyMods: "" })], entries, now)).toEqual([]);
    expect(withdrawalPenaltyRules([{ ...drug(), type: "weapon" }], entries, now)).toEqual([]);
  });
  it("две стопки одного наркотика дают один штраф, а не два", () => {
    const rules = withdrawalPenaltyRules([drug(), { ...drug(), id: "d2" }], entries, last + 3 * P);
    expect(rules).toHaveLength(1);
  });
});

describe("ключ журнала и подпись", () => {
  it("ключ тот же, что у недельного журнала доз", () => {
    expect(drugKey({ name: " Шквал " })).toBe(doseKey({ name: " Шквал " }));
  });
  it("новая запись: отсчёт от дозы, тестов не было", () => {
    expect(freshEntry(77)).toEqual({ lastDose: 77, doneTo: 77, tested: 0 });
  });
  it("подпись состояния: в срок / штраф / тест доступен", () => {
    const P = 24 * H, last = 10 * D;
    const e = freshEntry(last);
    expect(withdrawalStatusLabel(e, P, last + 5 * H)).toMatch(/до штрафа/);
    expect(withdrawalStatusLabel(e, P, last + P + H)).toMatch(/штраф/);
    expect(withdrawalStatusLabel(e, P, last + 2 * P)).toMatch(/−50/);
    expect(withdrawalStatusLabel(undefined, P, last)).toBe("");
  });
});
