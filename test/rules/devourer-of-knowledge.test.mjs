// test/rules/devourer-of-knowledge.test.mjs
//
// Devourer of Knowledge / Пожиратель Знаний (wdbc-1rno, Тзинч): чистая логика
// истечения временной кражи (worldTime/«Календарь») и динамический грант
// «Дружественный Навык» для перманентно украденных ключей.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { dayNumber, expiredTheftEntries, devourerPermanentRules, devouredSkillRank, DAY }
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

// Приём стопки #478-#481 (14.09.2026). Арифметика Ступеней жила внутри
// kind:"script" записи пака, где её не видел ни один тест, и ошибалась молча:
// перманентная кража стирала Навык у жертвы НАВСЕГДА и выдавала чемпиону
// «не изучен».
describe("devouredSkillRank — какая Ступень достаётся чемпиону", () => {
  // В ветку перманентной кражи попадают только когда вчерашняя временная
  // кража ещё жива, то есть Ступень жертвы ПРЯМО СЕЙЧАС уже "untrained".
  it("перманентная кража берёт Ступень ДО кражи, а не обнулённую текущую", () => {
    const prev = { victimPrevRank: "trained", lastDay: 8, streak: 9 };
    expect(devouredSkillRank(prev, "untrained", "untrained"))
      .toEqual({ stolen: "trained", gained: "trained" });
  });

  it("без записи прошлой кражи берётся текущая Ступень жертвы", () => {
    expect(devouredSkillRank(null, "veteran", "untrained"))
      .toEqual({ stolen: "veteran", gained: "veteran" });
  });

  // «Получить один из Навыков жертвы на том же уровне изучения», а не
  // «обменяться»: своя Ступень, если она выше, не понижается.
  it("собственная Ступень выше украденной — остаётся своя", () => {
    expect(devouredSkillRank(null, "trained", "veteran").gained).toBe("veteran");
  });

  it("собственная Ступень ниже украденной — берётся украденная", () => {
    expect(devouredSkillRank(null, "veteran", "trained").gained).toBe("veteran");
  });

  it("равные Ступени — ничего не меняется", () => {
    expect(devouredSkillRank(null, "trained", "trained").gained).toBe("trained");
  });

  it("пустые значения не роняют расчёт", () => {
    expect(devouredSkillRank(null, undefined, undefined))
      .toEqual({ stolen: "untrained", gained: "untrained" });
  });
});
