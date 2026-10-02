// test/rules/fail-degree-triggers.test.mjs
//
// Общий триггер «N+ Провала» (wdbc-1rno.22): книга много раз говорит «если
// провалил тест на N+ Провала, то…» — Инфернальная Воля (4+, тест Навыка, не
// Крит. Провал), «2+ Провала — 1 Усталость» при подъёме и толкании, «3+
// Провала» у Пыток. Порог, область теста и исключение Крит. Провала — данные
// записи, а не своя арифметика в каждом месте.

import { describe, it, expect } from "vitest";
import { failDegreesReached, matchFailDegreeTriggers, FAIL_DEGREE_TRIGGERS }
  from "../../module/rules/fail-degree-triggers.mjs";

const fail = (deg, critFailure = false) => ({ success: false, deg, crit: { success: false, failure: critFailure } });

describe("failDegreesReached — сам порог «N+ Провала»", () => {
  it("ровно N Провалов — да", () => {
    expect(failDegreesReached(fail(4), 4)).toBe(true);
  });

  it("больше N — да", () => {
    expect(failDegreesReached(fail(6), 4)).toBe(true);
  });

  it("N−1 — нет (граница не сдвинута на единицу)", () => {
    expect(failDegreesReached(fail(3), 4)).toBe(false);
  });

  it("Успех с той же степенью — нет: считаются Провалы, а не Успехи", () => {
    expect(failDegreesReached({ success: true, deg: 5, crit: { success: false, failure: false } }, 4)).toBe(false);
  });

  it("Крит. Провал — по умолчанию считается (правила «2+ Провала» его не исключают)", () => {
    expect(failDegreesReached(fail(5, true), 4)).toBe(true);
  });

  it("Крит. Провал при excludeCritFailure — нет", () => {
    expect(failDegreesReached(fail(5, true), 4, { excludeCritFailure: true })).toBe(false);
  });

  it("порог 2 и 3 работают так же — триггер общий, не зашит на 4", () => {
    expect(failDegreesReached(fail(2), 2)).toBe(true);
    expect(failDegreesReached(fail(2), 3)).toBe(false);
  });
});

describe("matchFailDegreeTriggers — отбор записей реестра", () => {
  const trig = { id: "t", capability: "cap.x", minDeg: 4, scope: "anyskill", excludeCritFailure: true, handler: "h" };
  const has = (flag) => flag === "cap.x";

  it("тест Навыка, 4 Провала, Возможность есть — срабатывает", () => {
    expect(matchFailDegreeTriggers(fail(4), { kind: "skill", skill: "charm", char: "fel" }, has, [trig]))
      .toEqual([trig]);
  });

  it("групповой Навык (ctx.group) — тоже тест Навыка", () => {
    expect(matchFailDegreeTriggers(fail(4), { kind: "skill", group: "trade", specialty: "Armourer", char: "int" }, has, [trig]))
      .toEqual([trig]);
  });

  it("тест Характеристики (нет ни skill, ни group) — не срабатывает", () => {
    expect(matchFailDegreeTriggers(fail(4), { kind: "skill", char: "wp" }, has, [trig])).toEqual([]);
  });

  it("нет Возможности — не срабатывает", () => {
    expect(matchFailDegreeTriggers(fail(4), { kind: "skill", skill: "charm" }, () => false, [trig])).toEqual([]);
  });

  it("Крит. Провал — не срабатывает, раз запись его исключает", () => {
    expect(matchFailDegreeTriggers(fail(5, true), { kind: "skill", skill: "charm" }, has, [trig])).toEqual([]);
  });

  it("запись без capability — книжное правило для всех (заготовка под «2+ Провала» подъёма)", () => {
    const book = { id: "b", minDeg: 2, scope: "all", handler: "h" };
    expect(matchFailDegreeTriggers(fail(2), { kind: "skill", char: "s" }, () => false, [book])).toEqual([book]);
  });
});

describe("реестр FAIL_DEGREE_TRIGGERS", () => {
  it("Инфернальная Воля: 4+ Провала, только тест Навыка, без Крит. Провала", () => {
    const iw = FAIL_DEGREE_TRIGGERS.find(t => t.capability === "mutation.infernalWill");
    expect(iw).toBeTruthy();
    expect(iw).toMatchObject({ minDeg: 4, scope: "anyskill", excludeCritFailure: true, handler: "infernalWillShock" });
  });

  it("у каждой записи есть id, порог ≥1 и обработчик", () => {
    for (const t of FAIL_DEGREE_TRIGGERS) {
      expect(t.id, JSON.stringify(t)).toBeTruthy();
      expect(t.minDeg, t.id).toBeGreaterThanOrEqual(1);
      expect(t.handler, t.id).toBeTruthy();
    }
  });
});
