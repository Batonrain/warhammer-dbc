// test/rules/training.test.mjs
//
// Книга — глава «Обучение», стр. 22: целевой запас xp, месячный журнал
// курсов, лимиты I.b/½I.b, суммирование Успехов учителя+ученика.

import { describe, it, expect } from "vitest";
import {
  trainingTargetKey, earmarkTotal, addTrainingEarmark, consumeTrainingEarmark,
  logCourse, coursesThisMonth, studentCapFromBonus, studentMonthlyCap,
  teacherCombinedLimit, studentBonusFromTeacherCombo, trainingXpGain
} from "../../module/rules/training.mjs";
import { SECONDS_PER_MONTH } from "../../module/constants/imperial-calendar.mjs";

describe("trainingTargetKey", () => {
  it("разные виды цели — разные ключи, регистр/пробелы специализации игнорируются", () => {
    expect(trainingTargetKey({ kind: "skill", key: "logic" })).toBe("skill:logic");
    expect(trainingTargetKey({ kind: "talent", key: "Teacher / Учитель" })).toBe("talent:teacher / учитель");
    expect(trainingTargetKey({ kind: "group", key: "forbiddenLore", specialty: " Mechanicum " }))
      .toBe("group:forbiddenlore:mechanicum");
    expect(trainingTargetKey({ kind: "char", key: "int" })).toBe("char:int");
  });
});

describe("целевой запас xp", () => {
  it("earmarkTotal суммирует только записи своей цели", () => {
    const log = [{ target: "skill:logic", amount: 10 }, { target: "talent:x", amount: 99 }, { target: "skill:logic", amount: 5 }];
    expect(earmarkTotal(log, "skill:logic")).toBe(15);
  });

  it("addTrainingEarmark добавляет запись, 0/отрицательное — не добавляет", () => {
    expect(addTrainingEarmark([], "skill:logic", "Исследование", 20)).toEqual([{ target: "skill:logic", label: "Исследование", amount: 20 }]);
    expect(addTrainingEarmark([], "skill:logic", "x", 0)).toEqual([]);
  });

  it("consumeTrainingEarmark: списывает до cost, остаток сверх цены теряется целиком", () => {
    const log = addTrainingEarmark([], "skill:logic", "курс 1", 40);
    const { discount, nextLog } = consumeTrainingEarmark(log, "skill:logic", 25);
    expect(discount).toBe(25);
    expect(earmarkTotal(nextLog, "skill:logic")).toBe(0); // 15 лишних — потеряны, не отложены
  });

  it("запаса нет — discount 0, журнал не трогается", () => {
    const { discount, nextLog } = consumeTrainingEarmark([], "skill:logic", 25);
    expect(discount).toBe(0);
    expect(nextLog).toEqual([]);
  });

  it("другая цель не задевается", () => {
    const log = addTrainingEarmark([], "skill:logic", "курс", 40);
    const { nextLog } = consumeTrainingEarmark(log, "talent:x", 10);
    expect(earmarkTotal(nextLog, "skill:logic")).toBe(40);
  });
});

describe("журнал курсов — месячное окно", () => {
  it("logCourse/coursesThisMonth — старше месяца не считается", () => {
    const now = SECONDS_PER_MONTH * 10;
    let log = logCourse(undefined, "course", now - SECONDS_PER_MONTH - 1); // месяц+1с назад
    log = logCourse(log, "course", now - 100);
    expect(coursesThisMonth(log, "course", now)).toBe(1);
  });

  it("пустой журнал — 0, не падает", () => {
    expect(coursesThisMonth(undefined, "course", 1000)).toBe(0);
  });
});

describe("лимиты I.b", () => {
  it("studentCapFromBonus: обычно I.b, с Teacher — 10×I.b", () => {
    expect(studentCapFromBonus(4, false)).toBe(4);
    expect(studentCapFromBonus(4, true)).toBe(40);
  });

  it("studentMonthlyCap: ½I.b округление вверх", () => {
    expect(studentMonthlyCap(3)).toBe(2);
    expect(studentMonthlyCap(4)).toBe(2);
  });

  it("studentMonthlyCap: NPC у держателя Teacher — 2×I.b УЧИТЕЛЯ, не ученика", () => {
    expect(studentMonthlyCap(1, { npcUnderTeacherTalent: true, teacherIntBonus: 5 })).toBe(10);
  });
});

describe("тесты курса", () => {
  it("teacherCombinedLimit: без соц.навыка — только Trade(Instructor)+10", () => {
    expect(teacherCombinedLimit({ total: 50 }, null)).toBe(60);
  });

  it("teacherCombinedLimit: с соц.навыком — + его rankBonus и mod (Logic–10)", () => {
    expect(teacherCombinedLimit({ total: 50 }, { rankBonus: 15, mod: -10 })).toBe(65); // 60+15-10
  });

  it("studentBonusFromTeacherCombo: 5×Успехи только при успехе", () => {
    expect(studentBonusFromTeacherCombo(3)).toBe(15);
    expect(studentBonusFromTeacherCombo(-2)).toBe(0);
    expect(studentBonusFromTeacherCombo(0)).toBe(0);
  });

  it("trainingXpGain: Провалы не вычитаются, успехи суммируются", () => {
    expect(trainingXpGain(2, 3)).toBe(25); // 5*(2+3)
    expect(trainingXpGain(-2, 3)).toBe(15); // учитель провалил — его 0, не -2
    expect(trainingXpGain(2, -3)).toBe(10);
  });

  it("trainingXpGain: doubleTeacher (Teacher/Учитель) удваивает только Успехи учителя", () => {
    expect(trainingXpGain(2, 3, { doubleTeacher: true })).toBe(35); // 5*(4+3)
  });
});
