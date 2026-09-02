import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { matchRule, collectRules } from "../../module/rules/collect.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

/** Снимок настоящих источников: тесты подменяют реестр и возвращают как было. */
const DEFAULT_SOURCES = getRuleSources();

const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: {}, ...system },
  items
});

let errors;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errors.mockRestore();
});

describe("matchRule", () => {
  const rule = { id: "test", when: { race: ["astartes"], sizeMax: 1 } };

  it("все условия истинны", () => {
    expect(matchRule(rule, actor({ race: "astartes", sizeMod: 1 }), {})).toBe(true);
  });

  it("одно условие ложно", () => {
    expect(matchRule(rule, actor({ race: "astartes", sizeMod: 2 }), {})).toBe(false);
  });

  it("пустой when означает «всегда»", () => {
    expect(matchRule({ id: "always" }, actor(), {})).toBe(true);
  });

  it("неизвестный ключ условия даёт false и ошибку в консоль", () => {
    const typo = { id: "typo", when: { hasTallent: "Frenzy" } };
    expect(matchRule(typo, actor({ items: [{ type: "talent", name: "Frenzy" }] }), {})).toBe(false);
    expect(errors).toHaveBeenCalledOnce();
  });
});

describe("collectRules", () => {
  const ids = rules => rules.map(r => r.id);

  beforeEach(() => {
    clearRuleSources();
  });

  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("собирает правила из всех источников", () => {
    registerRuleSource("первый", () => [{ id: "a" }]);
    registerRuleSource("второй", () => [{ id: "b" }]);
    expect(ids(collectRules(actor()))).toEqual(["a", "b"]);
  });

  it("отбрасывает правила с невыполненным условием", () => {
    registerRuleSource("раса", () => [
      { id: "a", when: { race: ["astartes"] } },
      { id: "b", when: { race: ["human"] } }
    ]);
    expect(ids(collectRules(actor({ race: "human" })))).toEqual(["b"]);
  });

  it("правило с overrides убирает вытесненное", () => {
    registerRuleSource("базовые", () => [{ id: "a" }]);
    registerRuleSource("расовые", () => [{ id: "b", overrides: ["a"] }]);
    expect(ids(collectRules(actor()))).toEqual(["b"]);
  });

  it("правило с невыполненным условием ничего не вытесняет", () => {
    registerRuleSource("базовые", () => [{ id: "a" }]);
    registerRuleSource("расовые", () => [{ id: "b", overrides: ["a"], when: { race: ["astartes"] } }]);
    expect(ids(collectRules(actor({ race: "human" })))).toEqual(["a"]);
  });

  it("взаимное вытеснение оставляет оба правила и пишет в консоль", () => {
    registerRuleSource("спорные", () => [
      { id: "a", overrides: ["b"] },
      { id: "b", overrides: ["a"] }
    ]);
    expect(ids(collectRules(actor()))).toEqual(["a", "b"]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("упавший источник не роняет сборку", () => {
    registerRuleSource("сломанный", () => { throw new Error("нет данных"); });
    registerRuleSource("рабочий",   () => [{ id: "a" }]);
    expect(ids(collectRules(actor()))).toEqual(["a"]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("контекст доходит до предикатов", () => {
    registerRuleSource("оружейные", () => [{ id: "a", when: { weaponClass: ["melee"] } }]);
    expect(ids(collectRules(actor(), { weapon: { system: { weaponClass: "melee" } } }))).toEqual(["a"]);
    expect(ids(collectRules(actor(), { weapon: { system: { weaponClass: "basic" } } }))).toEqual([]);
  });
});

describe("источники по умолчанию", () => {
  it("зарегистрированы основная книга, раса, Покровительство, Происхождение, предметы, Аватар Резни, Шаман Зверолюдей, Синэстезия, Адъютант, Зависимость и Дредноут", () => {
    expect(getRuleSources().map(([key]) => key))
      .toEqual(["core", "race", "patron", "homeworld", "items", "avatarOfSlaughter", "beastmanShaman", "synesthesia", "adjutant", "addiction", "dreadnought"]);
  });

  // Наполнена пока одна раса (этап 3 плана), у остальных поле rules пустое.
  it("раса без правил даёт пустую сборку и не жалуется", () => {
    const hero = actor({ race: "human", items: [{ type: "homeworld", system: { key: "hive" } }] });
    expect(collectRules(hero)).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("раса с правилами отдаёт их через настоящий источник", () => {
    const hero = actor({ race: "astartes", size: 1, items: [] });
    expect(collectRules(hero).map(r => r.id)).toContain("astartes.physiology");
    expect(errors).not.toHaveBeenCalled();
  });
});
