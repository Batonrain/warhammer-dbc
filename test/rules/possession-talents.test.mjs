// Общая Бойня: проявленный Одержимый — двое для численного превосходства (20.11.2026).
import { describe, it, expect } from "vitest";
import { outnumberWeight, manyEyedSightAngle } from "../../module/rules/possession-talents.mjs";

const a = (manifested, names = []) => ({ system: { possession: { manifested } }, items: names.map(name => ({ type: "talent", name })) });

describe("Общая Бойня", () => {
  it("за двоих только в Проявлении и с Талантом", () => {
    expect(outnumberWeight(a(true, ["Shared Slaughter / Общая Бойня"]))).toBe(2);
    expect(outnumberWeight(a(false, ["Shared Slaughter / Общая Бойня"]))).toBe(1);
    expect(outnumberWeight(a(true))).toBe(1);
    expect(outnumberWeight(null)).toBe(1);
  });
});

describe("Многоглазый", () => {
  it("круговой обзор только в Проявлении", () => {
    expect(manyEyedSightAngle(a(true, ["Many-Eyed / Дар: Многоглазый"]), 210)).toBe(360);
    expect(manyEyedSightAngle(a(false, ["Many-Eyed / Дар: Многоглазый"]), 210)).toBe(210);
  });
});
