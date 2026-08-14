// test/apps/veil-rituals.test.mjs
//
// Консоль Ритуалов (вкладка Завесы) работала только от пресетов книги: поля
// теста предмета-ритуала не читал никто, и ГМ переносил числа глазами
// (wdbc-lla). applyRitualItem — та же подстановка, что applyRitualPreset, но
// источником служит предмет на акторе.
//
// Проверяется чистая функция: список навыков подаётся снаружи (как и пресетам),
// поэтому ни живого актора Foundry, ни заглушки не нужно.

import { describe, it, expect } from "vitest";
import { applyRitualItem, buildRitualSkills } from "../../module/constants/rituals.mjs";

/** Актор с групповыми навыками: у каждой специализации своя строка. */
function actorFor({ groupSkills = {}, skills = {} } = {}) {
  return {
    system: {
      characteristics: { int: { total: 40 }, wp: { total: 35 }, per: { total: 30 } },
      skills, groupSkills
    }
  };
}

const ritual = system => ({ id: "rit-1", name: "Зов Малефика", type: "ritual", system });

const skillsOf = actor => buildRitualSkills(actor);

describe("подстановка ритуала-предмета в консоль", () => {
  const scholar = actorFor({
    groupSkills: {
      forbiddenLore: [
        { specialty: "Демоны", total: 38, rank: "knows",   char: "int" },
        { specialty: "Варп",   total: 45, rank: "adept",   char: "int" }
      ]
    },
    skills: { awareness: { total: 41, rank: "knows" } }
  });

  it("групповой навык берёт СВОЮ специализацию, а не первую попавшуюся", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp",
      testChar: "int", testMod: -20
    }), skillsOf);

    // «Warp» в книге, «Варп» у актора — сопоставитель специализаций общий с пресетами.
    const chosen = skillsOf(scholar).find(s => s.value === applied.skillValue);
    expect(chosen.label).toContain("Варп");
  });

  it("нужной специализации у актора нет — берётся любая из той же группы", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Ересь"
    }), skillsOf);

    expect(applied.skillValue).toMatch(/^group:forbiddenLore:/);
  });

  it("группы у актора нет вовсе — навык не подставляется молча", () => {
    const applied = applyRitualItem(actorFor(), ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp"
    }), skillsOf);

    expect(applied.skillValue).toBe("");
  });

  it("обычный навык подставляется по ключу", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "plain", testSkillKey: "awareness"
    }), skillsOf);

    expect(applied.skillValue).toBe("skill:awareness");
  });

  it("имя, характеристика и сложность переезжают в форму", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp",
      testChar: "wp", testMod: -30
    }), skillsOf);

    expect(applied.name).toBe("Зов Малефика");
    expect(applied.testChar).toBe("wp");
    expect(applied.gmMod).toBe(-30);
    expect(applied.itemId).toBe("rit-1");
  });

  it("пустой предмет даёт безопасные умолчания", () => {
    const applied = applyRitualItem(scholar, ritual({}), skillsOf);

    expect(applied.testChar).toBe("int");
    expect(applied.gmMod).toBe(0);
  });

  // Контентный тип предмета («Некромантия», «Ведьмограждение») не определяет
  // движковый: у пресетов одной категории встречаются и blessing, и summon, и
  // binding, а от движкового зависит Цена Ошибки при провале. Угадывать её за
  // ГМа нельзя, поэтому подстановка выбранный тип не трогает.
  it("движковый тип ритуала не подставляется", () => {
    const applied = applyRitualItem(scholar, ritual({ ritualType: "necromancy" }), skillsOf);

    expect(applied.type).toBeUndefined();
  });
});

