// Педаль в Пол (Разобрать jqrr4).
import { describe, it, expect } from "vitest";
import { pedalActive, pedalSpdBonus } from "../../module/rules/pedal-to-metal.mjs";
import { prepareVehicleDerived } from "../../module/rules/vehicle.mjs";

const mark = { bonus: 4, combatId: "c", round: 2, turn: 3 };
describe("Педаль в Пол", () => {
  it("действует в этот Раунд и до Хода водителя в следующем", () => {
    expect(pedalActive(mark, { id: "c", round: 2, turn: 5 })).toBe(true);
    expect(pedalActive(mark, { id: "c", round: 3, turn: 2 })).toBe(true);
    expect(pedalActive(mark, { id: "c", round: 3, turn: 3 })).toBe(false);
    expect(pedalActive(mark, { id: "other", round: 2, turn: 3 })).toBe(false);
  });
  it("прибавка к SPD машины", () => {
    const v = { flags: { "warhammer-dbc": { pedalToMetal: mark } } };
    expect(pedalSpdBonus(v, { id: "c", round: 2, turn: 4 })).toBe(4);
    const sys = { chassis: { type: "wheeled", spd: 10 }, size: 4 };
    prepareVehicleDerived([], sys, { spdBonus: 4 });
    expect(sys.derived.effSpd).toBe(14);
  });
});

import { pedalExpired } from "../../module/rules/pedal-to-metal.mjs";
describe("Педаль в Пол — снятие метки", () => {
  it("истекает с началом следующего Хода водителя", () => {
    const m = { bonus: 4, combatId: "c", round: 2, turn: 3 };
    expect(pedalExpired(m, { id: "c", round: 2, turn: 5 })).toBe(false);
    expect(pedalExpired(m, { id: "c", round: 3, turn: 3 })).toBe(true);
    expect(pedalExpired({ bonus: 4, combatId: "" }, null)).toBe(false);
  });
});
