// test/rules/leadership-talents.test.mjs
//
// Rancor / Злопамятность (Sahara 3-ac78, повторная разведка 19.10.2026):
// +10 на Команду и +1 к максимуму Успехов от Риска против цели Ненависти.
// Прямое расширение rules/hatred.mjs на тест Командования, не новая механика.

import { describe, it, expect } from "vitest";
import { hasRancor, rancorRiskCapBonus, leadershipTalentRules } from "../../module/rules/leadership-talents.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

const hatredTalent = (targets, name = "Hatred / Ненависть") => ({ type: "talent", name, system: { targets } });
const rancorTalent = (name = "Rancor / Злопамятность") => ({ type: "talent", name, system: {} });
const actorWith = (...items) => ({ items });

const orkTarget = raceTarget("ork", "Орк");
const orkActor = { system: { race: "ork" } };
const eldarActor = { system: { race: "eldar" } };

describe("hasRancor", () => {
  it("по любой половине двуязычного имени", () => {
    expect(hasRancor(actorWith(rancorTalent()))).toBe(true);
    expect(hasRancor(actorWith(rancorTalent("Rancor")))).toBe(true);
    expect(hasRancor(actorWith(rancorTalent("Злопамятность")))).toBe(true);
  });
  it("без Таланта — false", () => {
    expect(hasRancor(actorWith())).toBe(false);
    expect(hasRancor(actorWith(hatredTalent([orkTarget])))).toBe(false);
  });
});

describe("leadershipTalentRules (источник \"leadershipTalents\")", () => {
  it("пусто без Rancor, даже если цель Ненависти совпала", () => {
    const actor = actorWith(hatredTalent([orkTarget]));
    expect(leadershipTalentRules(actor, { targetActor: orkActor })).toEqual([]);
  });

  it("пусто с Rancor, но без целей Ненависти (нет Hatred)", () => {
    const actor = actorWith(rancorTalent());
    expect(leadershipTalentRules(actor, { targetActor: orkActor })).toEqual([]);
  });

  it("пусто с Rancor и Hatred, но цель броска не совпала", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(leadershipTalentRules(actor, { targetActor: eldarActor })).toEqual([]);
  });

  it("пусто без выделенной цели (targetActor не задан)", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(leadershipTalentRules(actor, {})).toEqual([]);
  });

  it("+10 на skill:command, когда цель Команды совпала с целью Ненависти", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    const rules = leadershipTalentRules(actor, { kind: "skill", skill: "command", targetActor: orkActor });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "skill:command", value: 10, label: "Злопамятность" }
    ]);
  });
});

describe("rancorRiskCapBonus", () => {
  it("0 без Rancor", () => {
    const actor = actorWith(hatredTalent([orkTarget]));
    expect(rancorRiskCapBonus(actor, { targetActor: orkActor })).toBe(0);
  });
  it("0 с Rancor, но цель не совпала или не выделена", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(rancorRiskCapBonus(actor, { targetActor: eldarActor })).toBe(0);
    expect(rancorRiskCapBonus(actor, {})).toBe(0);
  });
  it("1 с Rancor и совпавшей целью Ненависти", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(rancorRiskCapBonus(actor, { targetActor: orkActor })).toBe(1);
  });
});
