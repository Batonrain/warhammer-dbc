// test/rules/devourer-of-knowledge.test.mjs
//
// Devourer of Knowledge / Пожиратель Знаний (wdbc-1rno, Тзинч): чистая логика
// истечения временной кражи (worldTime/«Календарь») и динамический грант
// «Дружественный Навык» для перманентно украденных ключей.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { dayNumber, expiredTheftEntries, devourerPermanentRules, DAY }
  from "../../module/rules/devourer-of-knowledge.mjs";
import { resolveAptitudeOverride } from "../../module/rules/aptitude-overrides.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

describe("dayNumber", () => {
  it("целочисленный номер суток от worldTime", () => {
    expect(dayNumber(0)).toBe(0);
    expect(dayNumber(DAY - 1)).toBe(0);
    expect(dayNumber(DAY)).toBe(1);
    expect(dayNumber(DAY * 9 + 100)).toBe(9);
  });
});

describe("expiredTheftEntries", () => {
  it("отбирает только записи с истёкшим expiresAt", () => {
    const list = [
      { key: "a", expiresAt: 1000 },
      { key: "b", expiresAt: 2000 },
      { key: "c", expiresAt: 3000 }
    ];
    expect(expiredTheftEntries(list, 2000).map(r => r.key)).toEqual(["a", "b"]);
  });

  it("пустой/не-массив список — пустой результат, не падает", () => {
    expect(expiredTheftEntries([], 1000)).toEqual([]);
    expect(expiredTheftEntries(null, 1000)).toEqual([]);
    expect(expiredTheftEntries(undefined, 1000)).toEqual([]);
  });

  it("ровно в момент дедлайна — уже истекла (>=, не строго >)", () => {
    expect(expiredTheftEntries([{ key: "a", expiresAt: 1000 }], 1000)).toHaveLength(1);
    expect(expiredTheftEntries([{ key: "a", expiresAt: 1000 }], 999)).toHaveLength(0);
  });
});

describe("devourerPermanentRules", () => {
  it("без флага — пустой список правил", () => {
    expect(devourerPermanentRules({ getFlag: () => undefined })).toEqual([]);
  });

  it("по каждому перманентно украденному ключу — своё правило grantAptitudeOverride с ЛЕЙБЛОМ Навыка (не ключом схемы)", () => {
    // resolveAptitudeOverride (advance-category.mjs) сравнивает match с
    // def.label, не с ключом — иначе override молча никогда не совпал бы.
    const actor = { getFlag: () => ["interrogate", "medicae"] };
    const rules = devourerPermanentRules(actor);
    expect(rules).toHaveLength(2);
    expect(rules[0].effects).toEqual([
      { kind: "grantAptitudeOverride", scope: "skill", match: "Допрос", align: "ally" }
    ]);
    expect(rules[1].effects[0].match).toBe("Медика");
  });

  it("id правила уникален по ключу Навыка (не задваивается при повторном вызове)", () => {
    const actor = { getFlag: () => ["interrogate"] };
    expect(devourerPermanentRules(actor)[0].id).toBe(devourerPermanentRules(actor)[0].id);
  });
});

// Сквозная проверка (не только форма правила, а что resolveAptitudeOverride
// РЕАЛЬНО его понимает) — тот же приём, что test/rules/aptitude-
// overrides.test.mjs, зарегистрированный источник вместо изолированного
// вызова devourerPermanentRules напрямую.
describe("devourerPermanentRules — сквозная проверка через resolveAptitudeOverride", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("перманентно украденный Навык становится Дружественным для Продвижения", () => {
    const actor = { system: {}, items: [], getFlag: () => ["interrogate"] };
    clearRuleSources();
    registerRuleSource("test", a => devourerPermanentRules(a));
    // advance-category.mjs зовёт resolveAptitudeOverride ЛЕЙБЛОМ, не ключом.
    expect(resolveAptitudeOverride(actor, "skill", "Допрос")).toBe("ally");
  });

  it("Навык, которого нет в перманентном списке — не override", () => {
    const actor = { system: {}, items: [], getFlag: () => ["interrogate"] };
    clearRuleSources();
    registerRuleSource("test", a => devourerPermanentRules(a));
    expect(resolveAptitudeOverride(actor, "skill", "Медика")).toBeNull();
  });
});
