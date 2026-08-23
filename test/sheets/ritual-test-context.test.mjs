// test/sheets/ritual-test-context.test.mjs
//
// Путь проведения лежал в схеме с настоящими данными пресетов, но лист его
// не рисовал: игрок не видел, каким Навыком кидается ритуал и что у него
// −20, а Мастер не мог исправить ошибку (wdbc-lla). Список навыков зависит
// от вида: обычный и групповой — разные наборы, и один список на оба дал бы
// ключ, которого у актора не бывает.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { ritualTestContext } from "../../module/sheets/tabs/rituals.mjs";

/** Ритуал. */
const ritual = (id, name, system = {}) => ({ id, name, type: "ritual", system });

describe("поля теста на листе предмета-ритуала", () => {
  it("вид «групповой» даёт групповые навыки и отмечает выбранный", () => {
    const ctx = ritualTestContext(ritual("r1", "Зов", {
      testSkillScope: "group", testSkillKey: "forbiddenLore", testChar: "wp"
    }));

    expect(ctx.isGroupSkill).toBe(true);
    expect(ctx.skills.find(s => s.key === "forbiddenLore")?.selected).toBe(true);
    expect(ctx.skills.some(s => s.key === "awareness")).toBe(false);
  });

  it("вид «обычный» даёт обычные навыки", () => {
    const ctx = ritualTestContext(ritual("r1", "Круг", {
      testSkillScope: "plain", testSkillKey: "awareness"
    }));

    expect(ctx.isGroupSkill).toBe(false);
    expect(ctx.skills.find(s => s.key === "awareness")?.selected).toBe(true);
    expect(ctx.skills.some(s => s.key === "forbiddenLore")).toBe(false);
  });

  it("характеристика теста отмечается, по умолчанию Интеллект", () => {
    const chosen = ritualTestContext(ritual("r1", "Зов", { testChar: "wp" }));
    expect(chosen.chars.find(c => c.key === "wp")?.selected).toBe(true);

    const empty = ritualTestContext(ritual("r1", "Зов", {}));
    expect(empty.chars.find(c => c.key === "int")?.selected).toBe(true);
  });
});
