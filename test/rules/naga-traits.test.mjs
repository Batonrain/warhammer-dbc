// test/rules/naga-traits.test.mjs
//
// Черты Наги (глава I, «Нага») — чистая арифметика rules/naga-traits.mjs и
// правило Безграничного Тщеславия (rules/library/naga.mjs). Без Foundry.

import { describe, it, expect } from "vitest";
import {
  venomBiteDamage, adaptiveVenomCost, adaptiveVenomCandidates,
  constrictorTailSb, darkPrinceMilestonesDue, patronChangeBlocked,
  extraWoundDailyPlan, daysElapsed, SECONDS_PER_DAY, isSerpentine
} from "../../module/rules/naga-traits.mjs";
import { hasSnakeMutation, TARGET_FEATURES, targetMatches, featureTarget } from "../../module/rules/talent-targets.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { NAGA_RULES } from "../../module/rules/library/naga.mjs";
import { RACES } from "../../module/constants/races.mjs";
import { selectRules } from "../../module/rules/collect.mjs";

describe("Адаптивная Отрава: Укус 1d10 вместо 1d5", () => {
  it("меняется только куб 1d5", () => {
    expect(venomBiteDamage("1d5+3")).toBe("1d10+3");
    expect(venomBiteDamage("1d5")).toBe("1d10");
    expect(venomBiteDamage("2d10+1d5")).toBe("2d10+1d10");
  });
  it("чужие кубы не трогает", () => {
    expect(venomBiteDamage("1d10+3")).toBe("1d10+3");
    expect(venomBiteDamage("11d5")).toBe("11d5");
    expect(venomBiteDamage("1d50")).toBe("1d50");
  });
});

describe("Адаптивная Отрава: цена яда по Редкости", () => {
  it("R≤2 — 1, R3 — 3, R4 — 5, реже — нельзя", () => {
    expect([0, 1, 2, 3, 4, 5].map(adaptiveVenomCost)).toEqual([1, 1, 1, 3, 5, null]);
  });

  const poison = (name, deliveryMethod, availability, drugCategory = "poison") =>
    ({ name, system: { drugCategory, deliveryMethod, availability } });

  it("кандидаты: только яды с вектором рана/инъекция/еда и Редкостью до 4, дешёвые сверху", () => {
    const docs = [
      poison("Газ", "gas", 1), poison("Контакт", "contact", 2), poison("Рана", "wound", 3),
      poison("Еда", "food", 2), poison("Инъекция", "injection", 0), poison("Генофаг", "injection", 5),
      poison("Стимулятор", "injection", 1, "narcotic")
    ];
    expect(adaptiveVenomCandidates(docs).map(x => [x.doc.name, x.cost]))
      .toEqual([["Инъекция", 1], ["Еда", 1], ["Рана", 3]]);
  });

  it("бюджет Очков Бесчестия отсекает дорогие", () => {
    const docs = [poison("A", "wound", 1), poison("B", "wound", 3), poison("C", "food", 4)];
    expect(adaptiveVenomCandidates(docs, 3).map(x => x.doc.name)).toEqual(["A", "B"]);
  });
});

describe("Удав: S.b хвоста — Unnatural S (6)", () => {
  it("десятки Силы + 6", () => {
    expect(constrictorTailSb(30, 3)).toBe(9);
    expect(constrictorTailSb(47, 4)).toBe(10);
  });
  it("свой S.b больше — берётся свой", () => {
    expect(constrictorTailSb(30, 12)).toBe(12);
  });
});

describe("Дитя Тёмного Принца: пороги 30/60/90 Inf", () => {
  it("достигнутые и не отыгранные", () => {
    expect(darkPrinceMilestonesDue(24, [])).toEqual([]);
    expect(darkPrinceMilestonesDue(30, [])).toEqual([30]);
    expect(darkPrinceMilestonesDue(65, [30])).toEqual([60]);
    expect(darkPrinceMilestonesDue(95, [])).toEqual([30, 60, 90]);
  });
  it("«впервые» — отыгранный порог не повторяется, даже если Inf упала и выросла снова", () => {
    expect(darkPrinceMilestonesDue(35, [30])).toEqual([]);
  });
  it("Покровитель: сменить на другого нельзя, Слаанеш — можно", () => {
    expect(patronChangeBlocked("khorne")).toBe(true);
    expect(patronChangeBlocked("")).toBe(true);
    expect(patronChangeBlocked("slaanesh")).toBe(false);
    expect(patronChangeBlocked(undefined)).toBe(false);
  });
});

describe("Изуверская Физиология: +1 Рана в сутки", () => {
  it("первый проход только ставит метку", () => {
    expect(extraWoundDailyPlan({ lastAt: undefined, worldTime: 500, missing: 5 })).toEqual({ heal: 0, nextAt: 500, days: 0 });
  });
  it("меньше суток — ничего", () => {
    expect(extraWoundDailyPlan({ lastAt: 0, worldTime: SECONDS_PER_DAY - 1, missing: 5 }).nextAt).toBeNull();
  });
  it("по Ране за полные сутки, остаток суток не теряется", () => {
    const plan = extraWoundDailyPlan({ lastAt: 100, worldTime: 100 + 2.5 * SECONDS_PER_DAY, missing: 5 });
    expect(plan).toEqual({ heal: 2, nextAt: 100 + 2 * SECONDS_PER_DAY, days: 2 });
  });
  it("не больше, чем не хватает Ран; сутки здоровым в запас не копятся", () => {
    expect(extraWoundDailyPlan({ lastAt: 0, worldTime: 5 * SECONDS_PER_DAY, missing: 1 }).heal).toBe(1);
    expect(extraWoundDailyPlan({ lastAt: 0, worldTime: 5 * SECONDS_PER_DAY, missing: 0 })).toMatchObject({ heal: 0, nextAt: 5 * SECONDS_PER_DAY });
  });
  it("Календарь назад — долг не копится", () => {
    expect(daysElapsed(1000, 0)).toBe(0);
  });
});

describe("Безграничное Тщеславие: змееподобные", () => {
  const snake = (name, sub) => ({ type: "mutation", name, system: { submutation: { name: sub } } });

  it("мутант-змея — Центавр или Животный Гибрид со субмутацией Змея", () => {
    expect(hasSnakeMutation({ items: [snake("Centaur / Центавр", "Змея")] })).toBe(true);
    expect(hasSnakeMutation({ items: [snake("Animal Hybrid / Животный Гибрид", "Змея")] })).toBe(true);
    expect(hasSnakeMutation({ items: [snake("Centaur / Центавр", "Хищник")] })).toBe(false);
    expect(hasSnakeMutation({ items: [snake("Tail / Хвост", "Змея")] })).toBe(false);
    expect(hasSnakeMutation({})).toBe(false);
  });

  it("цель Ненависти «Мутант-змея» — признак, подходит мутанту и не подходит прочим", () => {
    const target = featureTarget("snakeMutation");
    expect(target).toMatchObject({ kind: "feature", value: "snakeMutation", name: TARGET_FEATURES.snakeMutation.label });
    expect(targetMatches(target, { targetActor: { items: [snake("Centaur / Центавр", "Змея")] } })).toBe(true);
    expect(targetMatches(target, { targetActor: { system: { race: "human" }, items: [] } })).toBe(false);
  });

  it("змееподобны: Нага, Сслит, мутант-змея; человек — нет", () => {
    expect(isSerpentine({ system: { race: "naga" } })).toBe(true);
    expect(isSerpentine({ system: { race: "sslyth" } })).toBe(true);
    expect(isSerpentine({ system: { race: "human" }, items: [snake("Centaur / Центавр", "Змея")] })).toBe(true);
    expect(isSerpentine({ system: { race: "human" }, items: [] })).toBe(false);
    expect(PREDICATES.targetSerpentine({}, {})).toBe(false);
  });

  const naga = { system: { race: "naga" }, items: [{ type: "trait", name: "Vanity Unbound / Безграничное Тщеславие" }] };
  const socialVs = targetActor => selectRules(NAGA_RULES, naga, { kind: "skill", skill: "charm", targetActor });

  it("−20 к общению со змееподобной целью", () => {
    const rules = socialVs({ system: { race: "naga" } });
    expect(rules.map(r => r.id)).toEqual(["naga.vanityUnbound.serpentineSocial"]);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "social", value: -20, auto: true });
  });
  it("с человеком штрафа нет", () => {
    expect(socialVs({ system: { race: "human" } })).toEqual([]);
  });
  it("без Черты штрафа нет", () => {
    const rules = selectRules(NAGA_RULES, { system: { race: "naga" }, items: [] },
      { kind: "skill", skill: "charm", targetActor: { system: { race: "naga" } } });
    expect(rules).toEqual([]);
  });
  it("правила приходят Наге от расы", () => {
    expect(RACES.naga.rules).toBe(NAGA_RULES);
  });
});
