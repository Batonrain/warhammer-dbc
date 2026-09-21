// test/rules/sustained-action.test.mjs
//
// Длительное/Расширенное действие (стр. 12) — арифметика банка Ходов, без
// Foundry (само хранение — актор-флаг, дело module/combat/sustained-action.mjs).

import { describe, it, expect } from "vitest";
import {
  sustainedActionKey, advanceSustainedAction, passCheckpoint,
  interruptSustainedAction, sustainedActionRows, SUSTAINED_ACTION_KINDS
} from "../../module/rules/sustained-action.mjs";

describe("sustainedActionKey", () => {
  it("тот же слаг, что у Расширенного теста", () => {
    expect(sustainedActionKey("Ремонт Реактора")).toBe("ремонт_реактора");
  });
});

describe("advanceSustainedAction", () => {
  it("первый Ход — банк 1, testDue false, пока не достигнут порог", () => {
    expect(advanceSustainedAction(null, 3)).toEqual({ turnsSinceCheck: 1, testDue: false });
  });

  it("продолжает копить банк по Ходу за раз", () => {
    const s1 = advanceSustainedAction(null, 3);
    const s2 = advanceSustainedAction(s1, 3);
    expect(s2).toEqual({ turnsSinceCheck: 2, testDue: false });
  });

  it("testDue становится true, когда банк достиг порога (Длительное — последний Ход, Расширенное — контрольная точка)", () => {
    const s1 = advanceSustainedAction(null, 2);
    const s2 = advanceSustainedAction(s1, 2);
    expect(s2).toEqual({ turnsSinceCheck: 2, testDue: true });
  });

  it("порог 1 — готово сразу с первого Хода", () => {
    expect(advanceSustainedAction(null, 1)).toEqual({ turnsSinceCheck: 1, testDue: true });
  });
});

describe("passCheckpoint (только Расширенное)", () => {
  it("счётчик точек растёт, банк с последней точки гасится", () => {
    const state = { checkpointsPassed: 0, turnsSinceCheck: 3, testDue: true };
    expect(passCheckpoint(state)).toEqual({ checkpointsPassed: 1, turnsSinceCheck: 0, testDue: false });
  });

  it("вторая точка подряд — счётчик продолжает расти", () => {
    const after1 = passCheckpoint({ checkpointsPassed: 1, turnsSinceCheck: 3, testDue: true });
    expect(after1).toEqual({ checkpointsPassed: 2, turnsSinceCheck: 0, testDue: false });
  });
});

describe("interruptSustainedAction", () => {
  it("Длительное (long) — банк ВЕСЬ сгорает (null: запись удаляется целиком)", () => {
    expect(interruptSustainedAction(SUSTAINED_ACTION_KINDS.LONG)).toBeNull();
  });

  it("Расширенное (extended) — обнуляет только счётчик с последней точки", () => {
    expect(interruptSustainedAction(SUSTAINED_ACTION_KINDS.EXTENDED))
      .toEqual({ turnsSinceCheck: 0, testDue: false });
  });
});

describe("sustainedActionRows", () => {
  it("пустой/отсутствующий объект флагов — пустой список", () => {
    expect(sustainedActionRows(null)).toEqual([]);
    expect(sustainedActionRows({})).toEqual([]);
  });

  it("читает поля, дефолтит kind к 'long' на мусорном значении, считает ready по порогу", () => {
    const rows = sustainedActionRows({
      ремонт: { kind: "extended", label: "Ремонт Реактора", threshold: 3, turnsSinceCheck: 3, checkpointsPassed: 1, testDue: true },
      ритуал: { kind: "long", label: "Ритуал Воззвания", threshold: 4, turnsSinceCheck: 2 }
    });
    expect(rows).toEqual([
      { key: "ремонт", kind: "extended", label: "Ремонт Реактора", threshold: 3, turnsSinceCheck: 3, checkpointsPassed: 1, testDue: true, ready: true },
      { key: "ритуал", kind: "long", label: "Ритуал Воззвания", threshold: 4, turnsSinceCheck: 2, checkpointsPassed: 0, testDue: false, ready: false }
    ]);
  });

  it("сортирует по названию (алфавит)", () => {
    const rows = sustainedActionRows({
      б: { label: "Бета", threshold: 1, turnsSinceCheck: 0 },
      а: { label: "Альфа", threshold: 1, turnsSinceCheck: 0 }
    });
    expect(rows.map(r => r.label)).toEqual(["Альфа", "Бета"]);
  });
});
