// test/rules/throwing-running.test.mjs
// 3-8318, Running Throw / Бросок на Бегу.
import { describe, it, expect } from "vitest";
import { runningThrowEligibleWeapon, runningThrowRange, hasRunningThrow, RUNNING_THROW_ACROBATICS_MOD }
  from "../../module/rules/throwing-talents.mjs";

const W = (sys, type = "weapon") => ({ type, system: sys });

describe("runningThrowEligibleWeapon", () => {
  it("метательное оружие и граната — да", () => {
    expect(runningThrowEligibleWeapon(W({ weaponClass: "thrown", weaponType: "lowtech", rof_single: 1 }))).toBe(true);
    expect(runningThrowEligibleWeapon(W({ weaponClass: "thrown", weaponType: "grenade", rof_single: 1 }))).toBe(true);
  });
  it("граната без одиночного режима (rof_single 0, как все гранаты пака) — да", () => {
    expect(runningThrowEligibleWeapon(W({ weaponClass: "thrown", weaponType: "grenade", rof_single: 0 }))).toBe(true);
  });
  it("бомба (explosive) — нет", () => {
    expect(runningThrowEligibleWeapon(W({ weaponClass: "thrown", weaponType: "explosive", rof_single: 1 }))).toBe(false);
  });
  it("не метательное, не оружие, без броска — нет", () => {
    expect(runningThrowEligibleWeapon(W({ weaponClass: "basic", rof_single: 1 }))).toBe(false);
    expect(runningThrowEligibleWeapon(W({ weaponClass: "thrown", weaponType: "grenade", rof_single: 1 }, "armor"))).toBe(false);
    expect(runningThrowEligibleWeapon(W({ weaponClass: "thrown", weaponType: "lowtech", rof_single: 0 }))).toBe(false);
    expect(runningThrowEligibleWeapon(null)).toBe(false);
  });
});

describe("дальность и тест", () => {
  it("Rng = S.b×2", () => {
    expect(runningThrowRange(4)).toBe(8);
    expect(runningThrowRange(0)).toBe(0);
    expect(runningThrowRange(-1)).toBe(0);
  });
  it("тест Acrobatics−10", () => expect(RUNNING_THROW_ACROBATICS_MOD).toBe(-10));
  it("Талант по имени", () => {
    expect(hasRunningThrow({ items: [{ type: "talent", name: "Running Throw / Бросок на Бегу", system: {} }] })).toBe(true);
    expect(hasRunningThrow({ items: [] })).toBe(false);
  });
});

// dbc-162: Rng метательного — S.b×3 (на бегу ×2); Балеарец прибавляет ½A.b к S.b и здесь.
import { thrownRange, balearicSbBonus as _bsb } from "../../module/rules/throwing-talents.mjs";
describe("thrownRange", () => {
  it("S.b×3, на бегу S.b×2", () => {
    expect(thrownRange(4)).toBe(12);
    expect(thrownRange(4, true)).toBe(8);
  });
  it("с прибавкой Балеарца (½A.b вверх) — дальность растёт", () => {
    expect(thrownRange(4 + 2)).toBe(18);
    expect(typeof _bsb).toBe("function");
  });
});
