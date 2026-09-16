// test/rules/overwatch.test.mjs
//
// wdbc-1rno.27: бюджет Одиночных выстрелов на один Караул (½BS.b(окр.▼),
// не больше наибольшего RoF оружия) и правило «Очередь расходует Караул
// целиком».

import { describe, it, expect } from "vitest";
import {
  overwatchSingleShotBudget, applyOverwatchShot, overwatchMaxArc,
  OVERWATCH_DEFAULT_MAX_ARC, OVERWATCH_SCANNING_ADVANCE_MAX_ARC
} from "../../module/rules/overwatch.mjs";

describe("overwatchSingleShotBudget", () => {
  it("BS.b 7, RoF 3/6 — ½BS.b(окр.▼)=3, капается на 6 → 3", () => {
    expect(overwatchSingleShotBudget({ bs: { bonus: 7 } }, { rof_semi: 3, rof_full: 6 })).toBe(3);
  });
  it("BS.b 6, RoF semi 3 — ½BS.b=3, RoF-потолок 3 → 3", () => {
    expect(overwatchSingleShotBudget({ bs: { bonus: 6 } }, { rof_semi: 3 })).toBe(3);
  });
  it("BS.b 8, RoF semi 2 — ½BS.b=4, но потолок RoF=2 → 2", () => {
    expect(overwatchSingleShotBudget({ bs: { bonus: 8 } }, { rof_semi: 2 })).toBe(2);
  });
  it("низкий BS.b (2) — ½BS.b(окр.▼)=1, минимум 1", () => {
    expect(overwatchSingleShotBudget({ bs: { bonus: 2 } }, { rof_semi: 3 })).toBe(1);
  });
  it("нет полей RoF вовсе — потолок 1", () => {
    expect(overwatchSingleShotBudget({ bs: { bonus: 10 } }, {})).toBe(1);
  });
});

describe("applyOverwatchShot", () => {
  it("Одиночный, остаток 3 — списывает 1, Караул остаётся активным", () => {
    expect(applyOverwatchShot("single", 3)).toEqual({ shotsRemaining: 2, exhausted: false });
  });
  it("Одиночный, остаток 1 — списывает последний, Караул исчерпан", () => {
    expect(applyOverwatchShot("single", 1)).toEqual({ shotsRemaining: 0, exhausted: true });
  });
  it("Короткая Очередь — расходует Караул целиком, независимо от остатка", () => {
    expect(applyOverwatchShot("semi", 3)).toEqual({ shotsRemaining: 0, exhausted: true });
  });
  it("Длинная Очередь — расходует Караул целиком", () => {
    expect(applyOverwatchShot("full", 5)).toEqual({ shotsRemaining: 0, exhausted: true });
  });
});

describe("overwatchMaxArc", () => {
  it("без Scanning Advance — 45°", () => {
    expect(overwatchMaxArc(false)).toBe(OVERWATCH_DEFAULT_MAX_ARC);
  });
  it("со Scanning Advance — 90°", () => {
    expect(overwatchMaxArc(true)).toBe(OVERWATCH_SCANNING_ADVANCE_MAX_ARC);
  });
});
