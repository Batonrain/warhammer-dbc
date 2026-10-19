// test/constants/training.test.mjs
import { describe, it, expect } from "vitest";
import {
  buildTeachableTargets, buildStudentTestOptions, instructorOption, socialSkillOption,
  KLAIVEX_DISCOUNT_ARCHETYPE
} from "../../module/constants/training.mjs";

function actorStub(over = {}) {
  return {
    items: [],
    system: {
      characteristics: { int: { total: 40 }, fel: { total: 30 }, wp: { total: 35 } },
      skills: {}, groupSkills: {},
      ...over
    }
  };
}

describe("buildTeachableTargets: только то, что учитель реально знает", () => {
  it("необученные Навыки не попадают в список", () => {
    const t = actorStub({ skills: { logic: { rank: "untrained", total: 20 } } });
    expect(buildTeachableTargets(t)).toEqual([]);
  });

  it("обученный плоский Навык, групповой Навык и Талант — все попадают", () => {
    const t = actorStub({
      skills: { logic: { rank: "trained", total: 60 } },
      groupSkills: { forbiddenLore: [{ specialty: "Mechanicum", rank: "knows", total: 40 }] }
    });
    t.items = [{ type: "talent", name: "Teacher / Учитель" }];
    const targets = buildTeachableTargets(t);
    expect(targets.find(x => x.value === "skill:logic")).toBeTruthy();
    expect(targets.find(x => x.value === "group:forbiddenLore:Mechanicum")).toBeTruthy();
    expect(targets.find(x => x.value === "talent:Teacher / Учитель")).toBeTruthy();
  });

  // wdbc-5yafq: Клэйвекс учит не Навыку, а «искусству Инкубов» — цель
  // появляется от самого Таланта, не от рангов/записей на листе учителя.
  it("учитель-Клэйвекс получает цель «Искусство Инкубов», обычный учитель — нет", () => {
    const plain = actorStub();
    expect(buildTeachableTargets(plain).some(x => x.kind === "archetype")).toBe(false);

    const klaivex = actorStub();
    klaivex.items = [{ type: "talent", name: "Klaivex / Клэйвекс" }];
    const targets = buildTeachableTargets(klaivex);
    const found = targets.find(x => x.kind === "archetype");
    expect(found).toBeTruthy();
    expect(found.key).toBe(KLAIVEX_DISCOUNT_ARCHETYPE);
    expect(found.value).toBe(`archetype:${KLAIVEX_DISCOUNT_ARCHETYPE}`);
  });
});

describe("buildStudentTestOptions: только I или Logic", () => {
  it("две фиксированные опции", () => {
    const s = actorStub({ skills: { logic: { total: 55 } } });
    const opts = buildStudentTestOptions(s);
    expect(opts).toEqual([
      { value: "char:int", label: "Intelligence (I)", total: 40 },
      { value: "skill:logic", label: "Logic (I)", total: 55 }
    ]);
  });

  it("Logic не куплен — необученная подстановка от Int", () => {
    const s = actorStub();
    expect(buildStudentTestOptions(s)[1].total).toBe(20); // 40 - 20
  });
});

describe("instructorOption", () => {
  it("нет специализации Instructor — необученная Int", () => {
    expect(instructorOption(actorStub()).total).toBe(20);
    expect(instructorOption(actorStub()).found).toBe(false);
  });

  it("есть специализация Instructor — её total", () => {
    const t = actorStub({ groupSkills: { trade: [{ specialty: "Instructor", total: 70, rank: "veteran" }] } });
    const opt = instructorOption(t);
    expect(opt.total).toBe(70);
    expect(opt.found).toBe(true);
  });
});

describe("socialSkillOption", () => {
  it("Logic несёт модификатор -10 из книги, Charm/Intimidate — 0", () => {
    expect(socialSkillOption(actorStub(), "logic").mod).toBe(-10);
    expect(socialSkillOption(actorStub(), "charm").mod).toBe(0);
  });
  it("неизвестный ключ — null", () => {
    expect(socialSkillOption(actorStub(), "xyz")).toBeNull();
  });
});
