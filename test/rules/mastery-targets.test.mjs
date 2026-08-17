// test/rules/mastery-targets.test.mjs
//
// «Mastery / Мастерство» (корбук стр. 62) владеет конкретным Навыком и
// наследует его склонности, а от них зависит цена (стр. 23-24). Значит, список
// целей — не украшение списка, а то, чем считается цена, и он обязан включать
// специализации групп: «Запретные знания» вообще выучить нельзя.

import { describe, it, expect } from "vitest";
import { masteryTargets, masteryTarget, masteryLabel, masteryAptitudes }
  from "../../module/rules/mastery-targets.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { SKILL_SPECIALIZATIONS } from "../../module/constants/skill-specializations.mjs";
import { resolveTalentAptitudes } from "../../module/constants/advancement.mjs";

const keys = () => masteryTargets().map(t => t.key);

describe("цели Мастерства", () => {
  it("включают каждый обычный Навык", () => {
    const all = keys();
    for (const k of Object.keys(SKILLS_DEF)) expect(all).toContain(k);
  });

  // Группа целиком осталась целью: так привязка писалась раньше, и уже
  // купленные Таланты не должны осиротеть.
  it("включают и группу целиком, и каждую её специализацию", () => {
    const all = keys();
    expect(all).toContain("forbiddenLore");
    expect(all).toContain("forbiddenLore:daemons");
    expect(masteryLabel("forbiddenLore:daemons")).toBe("Запретные знания (Демоны)");
  });

  // «<Регион>» — не предмет владения, пока регион не назван, а назвать его в
  // списке негде.
  it("не предлагают свободные специализации-заготовки", () => {
    expect(keys()).not.toContain("commonLore:region");
  });

  it("ключи не повторяются", () => {
    const all = keys();
    expect(new Set(all).size).toBe(all.length);
  });

  it("счёт целей сходится с таблицами Навыков", () => {
    const specs = Object.entries(SKILL_SPECIALIZATIONS)
      .filter(([g]) => GROUP_SKILLS_DEF[g])
      .reduce((n, [, list]) => n + list.filter(s => !s.free).length, 0);
    expect(masteryTargets()).toHaveLength(
      Object.keys(SKILLS_DEF).length + Object.keys(GROUP_SKILLS_DEF).length + specs);
  });
});

describe("склонности цели", () => {
  it("обычный Навык отдаёт свои две", () => {
    expect(masteryAptitudes("dodge")).toEqual([SKILLS_DEF.dodge.char, SKILLS_DEF.dodge.apt2]);
  });

  it("группа без специализации отдаёт свои", () => {
    expect(masteryAptitudes("forbiddenLore"))
      .toEqual([GROUP_SKILLS_DEF.forbiddenLore.char, GROUP_SKILLS_DEF.forbiddenLore.apt2]);
  });

  // У специализации бывает своя базовая Характеристика — она и идёт первой.
  it("специализация со своей Характеристикой перебивает группу", () => {
    const warp = SKILL_SPECIALIZATIONS.navigation?.find(s => s.char);
    if (!warp) return;                      // в таблице нет исключений — проверять нечего
    expect(masteryAptitudes(`navigation:${warp.key}`)[0]).toBe(warp.char);
  });

  it("незнакомый ключ не выдумывает склонностей", () => {
    expect(masteryAptitudes("нет-такого")).toEqual([]);
    expect(masteryTarget("нет-такого")).toBe(null);
  });
});

// Склонности пересчитываются с листа по сохранённому ключу привязки, поэтому
// общий resolveTalentAptitudes обязан понимать составной ключ так же.
describe("пересчёт склонностей с листа", () => {
  const defs = { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF };

  it("составной ключ читается так же, как в списке целей", () => {
    expect(resolveTalentAptitudes("Mastery / Мастерство", [], "forbiddenLore:daemons", defs))
      .toEqual(masteryAptitudes("forbiddenLore:daemons"));
  });

  it("прежний ключ группы читается по-прежнему", () => {
    expect(resolveTalentAptitudes("Mastery", [], "forbiddenLore", defs))
      .toEqual([GROUP_SKILLS_DEF.forbiddenLore.char, GROUP_SKILLS_DEF.forbiddenLore.apt2]);
  });

  it("у чужого Таланта привязка ничего не меняет", () => {
    expect(resolveTalentAptitudes("Cleave", ["ws", "offence"], "dodge", defs))
      .toEqual(["ws", "offence"]);
  });
});
