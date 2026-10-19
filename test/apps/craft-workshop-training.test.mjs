// test/apps/craft-workshop-training.test.mjs
//
// Обучение (книга, стр. 22) внутри Мастерской: _rollTrainingSession (сеанс =
// смена Крафта для Усталости) и _finishTrainingCourse (combined-тест учителя
// + собственный тест каждого ученика, xp только в целевой запас — тратится
// автоматически позже в module/sheets/tabs/advance.mjs, см. test/sheets/
// advance-training-earmark.test.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";
import { TRAINING_EARMARK_FLAG, TRAINING_COURSE_LOG_FLAG, TRAINING_ELITE_DISCOUNT_FLAG,
         trainingTargetKey } from "../../module/rules/training.mjs";
import { KLAIVEX_DISCOUNT_ARCHETYPE } from "../../module/constants/training.mjs";

function flagActor(over = {}) {
  const flags = {};
  return {
    id: over.id || "a1", name: over.name || "Актор", type: "character",
    testUserPermission: () => false,
    items: over.items || [],
    system: {
      characteristics: { int: { total: 40, bonus: 4 }, fel: { total: 30, bonus: 3 }, wp: { total: 35, bonus: 3 } },
      skills: {}, groupSkills: {}, fatigue: { value: 0 },
      ...over.system
    },
    update: async () => {},
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => { (flags[scope] ??= {})[key] = value; },
    _flags: flags
  };
}

function newTrainingApp({ teacher, students = [{ id: "s1", testKey: "char:int" }], over = {} } = {}) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "", collapsed: false, mode: "training",
    crafterId: teacher.id, categoryKey: "explosive",
    rarity: 0, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: 20, improve: false, monotony: false,
    diceMode: "normal", slowShift: false,
    researchKind: "blueprint", psychicResultType: "psychicPower", studyTarget: "", findingCreated: false,
    trainingTarget: "", socialKey: "", students, sessionCount: 0, courseLog: [],
    vatKey: "common", bioTarget: "common", bioSkill: "medicae",
    bioImplant: "", bioAdvanced: false, bioLarge: false, bioHaem: false, bioCycle: 0, bioLog: [],
    skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 },
    ...over
  }];
  app.render = () => {};
  return app;
}

let teacher, student;
beforeEach(() => {
  resetCaptured();
  teacher = flagActor({ id: "t1", name: "Наставник", items: [{ type: "talent", name: "Teacher / Учитель" }].slice(0, 0) });
  teacher.system.skills.logic = { rank: "trained", total: 60 };
  teacher.system.groupSkills.trade = [{ specialty: "Instructor", rank: "veteran", total: 70 }];
  student = flagActor({ id: "s1", name: "Ученик" });
  globalThis.game.actors = { get: id => (id === "t1" ? teacher : id === "s1" ? student : null) };
  globalThis.game.users = [{ isGM: true }];
});

describe("_rollTrainingSession", () => {
  it("тикает счётчик и даёт Усталость учителю и ученикам", async () => {
    const app = newTrainingApp({ teacher });
    await app._rollTrainingSession("p1");
    expect(app.projects[0].sessionCount).toBe(1);
  });

  it("без учителя — предупреждает, не тикает", async () => {
    const app = newTrainingApp({ teacher: { id: "ghost" } });
    globalThis.game.actors = { get: () => null };
    await app._rollTrainingSession("p1");
    expect(app.projects[0].sessionCount).toBe(0);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("без учеников — предупреждает, не тикает", async () => {
    const app = newTrainingApp({ teacher, students: [] });
    await app._rollTrainingSession("p1");
    expect(app.projects[0].sessionCount).toBe(0);
  });

  it("больше 8 сеансов не тикает", async () => {
    const app = newTrainingApp({ teacher, over: { sessionCount: 8 } });
    await app._rollTrainingSession("p1");
    expect(app.projects[0].sessionCount).toBe(8);
  });
});

describe("_finishTrainingCourse: базовый курс", () => {
  it("меньше 8 сеансов — отказ, без бросков", async () => {
    const app = newTrainingApp({ teacher, over: { sessionCount: 3 } });
    await app._finishTrainingCourse("p1");
    expect(captured.rolls).toEqual([]);
    expect(student.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toBeUndefined();
  });

  it("8 сеансов, успешные тесты — ученик получает целевой xp, НЕ system.experience.total", async () => {
    const app = newTrainingApp({ teacher, over: { sessionCount: 8, trainingTarget: "skill:logic" } });
    captured.nextRoll = 10; // низкий бросок — успех у всех
    await app._finishTrainingCourse("p1");

    const log = student.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG);
    expect(log).toHaveLength(1);
    expect(log[0].target).toBe(trainingTargetKey({ kind: "skill", key: "logic" }));
    expect(log[0].amount).toBeGreaterThan(0);
    expect(app.projects[0].sessionCount).toBe(0); // курс сброшен
    expect(captured.chat[0].content).toContain("Курс обучения завершён");
  });

  it("записывает курс в месячный журнал ученика", async () => {
    const app = newTrainingApp({ teacher, over: { sessionCount: 8 } });
    captured.nextRoll = 10;
    await app._finishTrainingCourse("p1");
    const log = student.getFlag("warhammer-dbc", TRAINING_COURSE_LOG_FLAG);
    expect(log?.course).toHaveLength(1);
  });

  it("нет цели (учитель ничего не знает) — отказ", async () => {
    const bareTeacher = flagActor({ id: "t2", name: "Пустой" });
    globalThis.game.actors = { get: id => (id === "t2" ? bareTeacher : id === "s1" ? student : null) };
    const app = newTrainingApp({ teacher: bareTeacher, over: { sessionCount: 8 } });
    await app._finishTrainingCourse("p1");
    expect(captured.rolls).toEqual([]);
  });

  it("учеников больше лимита I.b — отказ", async () => {
    const manyStudents = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, testKey: "char:int" }));
    globalThis.game.actors = {
      get: id => (id === "t1" ? teacher : manyStudents.some(s => s.id === id) ? flagActor({ id }) : null)
    };
    const app = newTrainingApp({ teacher, students: manyStudents, over: { sessionCount: 8 } });
    await app._finishTrainingCourse("p1"); // teacher int.bonus=4 → лимит 4 ученика
    expect(captured.rolls).toEqual([]);
    expect(captured.warnings.some(w => w.includes("Слишком много"))).toBe(true);
  });
});

describe("_finishTrainingCourse: месячный лимит ученика", () => {
  it("ученик уже выбрал ½I.b курсов в месяц — весь курс блокируется", async () => {
    // intBonus ученика = 4 → studentMonthlyCap = ceil(4/2) = 2. Два прошлых курса "сейчас".
    await student.setFlag("warhammer-dbc", TRAINING_COURSE_LOG_FLAG, { course: [0, 0] });
    const app = newTrainingApp({ teacher, over: { sessionCount: 8 } });
    await app._finishTrainingCourse("p1");
    expect(captured.rolls).toEqual([]);
    expect(student.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toBeUndefined();
  });
});

describe("_finishTrainingCourse: Teacher/Учитель", () => {
  it("удваивает Успехи учителя в xp, снимает Усталость с учителя за сеанс, ×10 I.b", async () => {
    teacher.items = [{ type: "talent", name: "Teacher / Учитель" }];
    const app = newTrainingApp({ teacher, over: { sessionCount: 8, trainingTarget: "skill:logic" } });
    await app._rollTrainingSession("p1"); // не должно дать Усталости учителю (не проверяем update напрямую — просто не падает)
    captured.nextRoll = 10;
    await app._finishTrainingCourse("p1");
    expect(captured.chat[0].content).toContain("Успехи ×2");

    // Лимит на учеников: int.bonus=4, ×10 = 40 — 10 учеников не блокируются.
    const manyStudents = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, testKey: "char:int" }));
    globalThis.game.actors = {
      get: id => (id === "t1" ? teacher : manyStudents.some(s => s.id === id) ? flagActor({ id }) : null)
    };
    const app2 = newTrainingApp({ teacher, students: manyStudents, over: { sessionCount: 8 } });
    captured.nextRoll = 10;
    await app2._finishTrainingCourse("p1");
    expect(captured.warnings.some(w => w.includes("Слишком много"))).toBe(false);
  });
});

// Klaivex (wdbc-5yafq): цель курса «Искусство Инкубов» — не xp-запас, при
// успехе финального теста ученик получает скидку на архетип Инкуб
// (TRAINING_ELITE_DISCOUNT_FLAG), а не запись в TRAINING_EARMARK_FLAG.
describe("_finishTrainingCourse: Klaivex — скидка на архетип Инкуб", () => {
  beforeEach(() => {
    teacher.items = [{ type: "talent", name: "Klaivex / Клэйвекс" }];
  });

  it("успешный финальный тест — ученику ставится скидка, НЕ xp-запас", async () => {
    const app = newTrainingApp({
      teacher, over: { sessionCount: 8, trainingTarget: `archetype:${KLAIVEX_DISCOUNT_ARCHETYPE}` }
    });
    captured.nextRoll = 10; // низкий бросок — успех у всех
    await app._finishTrainingCourse("p1");

    expect(student.getFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG)).toEqual([KLAIVEX_DISCOUNT_ARCHETYPE]);
    expect(student.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toBeUndefined();
    expect(captured.chat[0].content).toContain("скидка вдвое");
  });

  it("провал финального теста (0 успехов обеих сторон) — скидка не даётся", async () => {
    const app = newTrainingApp({
      teacher, over: { sessionCount: 8, trainingTarget: `archetype:${KLAIVEX_DISCOUNT_ARCHETYPE}` }
    });
    captured.nextRoll = 99; // высокий бросок — провал у всех
    await app._finishTrainingCourse("p1");

    expect(student.getFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG)).toBeUndefined();
    expect(captured.chat[0].content).toContain("скидка не получена");
  });
});

describe("_finishTrainingCourse: соц. комбинированный тест", () => {
  it("успешный combined-тест учителя даёт ученику +5×Успехи к Пределу", async () => {
    const app = newTrainingApp({ teacher, over: { sessionCount: 8, socialKey: "charm" } });
    captured.nextRoll = 10;
    await app._finishTrainingCourse("p1");
    expect(captured.chat[0].content).toContain("+5×Успехи");
  });
});
