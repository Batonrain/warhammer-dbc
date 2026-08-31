import { describe, it, expect } from "vitest";
import { entryWhenOk, whenConditions, whenSubmutations, whenTalentSpec } from "../../module/rules/mech-when.mjs";

const actorWithItems = (items = [], geneSeed = {}) => ({
  system: { geneSeed, bio: { age: 0 } },
  items
});

describe("entryWhenOk: без условий — всегда true", () => {
  it("entry.when отсутствует", () => {
    expect(entryWhenOk(actorWithItems(), {})).toBe(true);
  });
});

describe("entryWhenOk: Геносемя (регресс, не должен был измениться)", () => {
  const entry = { when: { negate: false, conditions: [{ legion: "I" }] } };
  it("подходящий легион — true", () => {
    expect(entryWhenOk(actorWithItems([], { legion: "I" }), entry)).toBe(true);
  });
  it("другой легион — false", () => {
    expect(entryWhenOk(actorWithItems([], { legion: "II" }), entry)).toBe(false);
  });
});

describe("entryWhenOk: Талант+специализация (wdbc-ta4y)", () => {
  // itemHasName сравнивает wanted с КАЖДОЙ билингвальной половиной имени
  // предмета по отдельности (rules/predicates.mjs) — значит и в when.talentSpec.name
  // должна лежать ОДНА половина ("Мастерство"), а не полная строка со слэшем.
  const entry = { when: { talentSpec: { name: "Мастерство", specialization: "Психонаука" } } };

  it("нет актора (превью) — условие пройдено", () => {
    expect(entryWhenOk(null, entry)).toBe(true);
  });

  it("нет такого Таланта вовсе — false", () => {
    expect(entryWhenOk(actorWithItems([]), entry)).toBe(false);
  });

  it("Талант есть, но специализация другая — false", () => {
    const actor = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "Уклонение" } }
    ]);
    expect(entryWhenOk(actor, entry)).toBe(false);
  });

  it("Талант с нужной специализацией — true", () => {
    const actor = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "Психонаука" } }
    ]);
    expect(entryWhenOk(actor, entry)).toBe(true);
  });

  it("сравнение по любой билингвальной половине имени, без учёта регистра/пробелов", () => {
    const actor = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "  психонаука  " } }
    ]);
    expect(entryWhenOk(actor, { when: { talentSpec: { name: "мастерство", specialization: "Психонаука" } } }))
      .toBe(true);
  });

  it("годится и Черта (trait), не только Талант", () => {
    const actor = actorWithItems([
      { type: "trait", name: "Mastery / Мастерство", system: { specialization: "Психонаука" } }
    ]);
    expect(entryWhenOk(actor, entry)).toBe(true);
  });

  it("negateTalent переворачивает результат", () => {
    const withTalent = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "Психонаука" } }
    ]);
    const without = actorWithItems([]);
    const negated = { when: { talentSpec: entry.when.talentSpec, negateTalent: true } };
    expect(entryWhenOk(withTalent, negated)).toBe(false);
    expect(entryWhenOk(without, negated)).toBe(true);
  });
});

describe("entryWhenOk: гейты независимы и складываются через И", () => {
  it("Геносемя проходит, Талант — нет: итог false", () => {
    const actor = actorWithItems([], { legion: "I" });
    const entry = {
      when: {
        negate: false, conditions: [{ legion: "I" }],
        talentSpec: { name: "Mastery / Мастерство", specialization: "Психонаука" }
      }
    };
    expect(entryWhenOk(actor, entry)).toBe(false);
  });
});

describe("whenConditions/whenSubmutations/whenTalentSpec: геттеры не считают частично заполненные записи", () => {
  it("talentSpec без specialization не считается заполненным", () => {
    expect(whenTalentSpec({ talentSpec: { name: "X", specialization: "" } })).toBeNull();
    expect(whenTalentSpec({ talentSpec: { name: "", specialization: "Y" } })).toBeNull();
    expect(whenTalentSpec({})).toBeNull();
  });
  it("conditions/submutations — регресс на пустых значениях", () => {
    expect(whenConditions({})).toEqual([]);
    expect(whenSubmutations({})).toEqual([]);
  });
});
