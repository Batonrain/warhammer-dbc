// test/rules/drug-doses.test.mjs
//
// wdbc-gyqf2. Недельный счётчик доз (корбук, «Наркотики: Зависимость»):
// при N-м применении за неделю — тест Зависимости, −10 за каждое применение
// сверх; Репликант удваивает лимит, Толерантность +1 за копию Таланта.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DOSE_WEEK_SECONDS, doseKey, logDose, dosesThisWeek, toleranceRanks, weeklyDoseLimit, addictionCheckFor
} from "../../module/rules/drug-doses.mjs";
import { weeklyDoseCheck } from "../../module/sheets/tabs/drugs.mjs";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";

const NOW = 10_000_000;
const talent = name => ({ type: "talent", name, system: {} });

describe("журнал доз", () => {
  it("считает за скользящую неделю; старше недели отбрасывается", () => {
    let log = {};
    log = logDose(log, "Пыльца", NOW - 8 * 86400);
    log = logDose(log, "Пыльца", NOW - 3 * 86400);
    log = logDose(log, "Пыльца", NOW);
    expect(dosesThisWeek(log, "Пыльца", NOW)).toBe(2);
    expect(log["Пыльца"]).toHaveLength(2);
    expect(DOSE_WEEK_SECONDS).toBe(7 * 86400);
  });
  it("разные наркотики считаются порознь; пустые записи чистятся", () => {
    let log = logDose({}, "Старый", NOW - 20 * 86400);
    log = logDose(log, "Новый", NOW);
    expect(Object.keys(log)).toEqual(["Новый"]);
  });
  it("ключ — название препарата", () => {
    expect(doseKey({ name: " Шквал " })).toBe("Шквал");
  });
});

describe("лимит и штраф", () => {
  it("Толерантность: +1 за каждую копию; без лимита (minDose 0) проверки нет", () => {
    const a = { items: [talent("Tolerance / Толерантность"), talent("Tolerance / Толерантность")] };
    expect(toleranceRanks(a)).toBe(2);
    expect(weeklyDoseLimit(a, 3)).toBe(5);
    expect(weeklyDoseLimit(a, 0)).toBe(0);
  });
  it("тест на достижении лимита, штраф −10 за каждое применение сверх", () => {
    expect(addictionCheckFor(2, 3)).toBeNull();
    expect(addictionCheckFor(3, 3)).toEqual({ penalty: 0, over: 0 });
    expect(addictionCheckFor(5, 3)).toEqual({ penalty: -20, over: 2 });
    expect(addictionCheckFor(5, 0)).toBeNull();
  });
});

describe("weeklyDoseCheck: тест при достижении лимита", () => {
  const flags = {};
  const actor = (extra = {}) => ({
    name: "Ходок", items: [], system: { characteristics: { t: { total: 40, bonus: 4 } } },
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async () => {}, ...extra
  });
  const drugItem = (minDose, isAddicted = false) => ({
    name: "Шквал", type: "drug", update: async () => {},
    system: { addiction: { hasAddiction: true, isAddicted, minDose, testChar: "t", testMod: 30 } }
  });
  beforeEach(() => {
    resetCaptured();
    for (const k of Object.keys(flags)) delete flags[k];
    globalThis.game.time = { worldTime: NOW };
    captured.dice = [50];
    clearRuleSources();
  });
  afterEach(() => clearRuleSources());

  it("до лимита теста нет, на лимите — есть, с модификатором наркотика", async () => {
    const a = actor();
    const d = drugItem(3);
    await weeklyDoseCheck(a, d);
    await weeklyDoseCheck(a, d);
    expect(captured.chat).toHaveLength(0);
    await weeklyDoseCheck(a, d);
    expect(captured.chat.at(-1).content).toContain("Тест Зависимости");
  });

  it("уже зависимому тест не навязывается; наркотик без зависимости игнорируется", async () => {
    const a = actor();
    for (let i = 0; i < 5; i++) await weeklyDoseCheck(a, drugItem(2, true));
    expect(captured.chat).toHaveLength(0);
    const plain = { name: "Рекаф", type: "drug", system: { addiction: { hasAddiction: false, minDose: 2 } } };
    for (let i = 0; i < 5; i++) await weeklyDoseCheck(a, plain);
    expect(captured.chat).toHaveLength(0);
  });

  it("Репликант (Алхимическое Чудовище) — лимит вдвое, тест только на 4-й дозе вместо 2-й", async () => {
    registerRuleSource("test", () => [{ id: "t", when: {}, effects: [{ kind: "grantFlag", target: "trait.alchemMonster" }] }]);
    const a = actor();
    const d = drugItem(2);
    for (let i = 0; i < 3; i++) await weeklyDoseCheck(a, d);
    expect(captured.chat).toHaveLength(0);
    captured.dice = [50, 50]; // успех обязательно перебрасывается
    await weeklyDoseCheck(a, d);
    expect(captured.chat.at(-1).content).toContain("Тест Зависимости");
  });
});
