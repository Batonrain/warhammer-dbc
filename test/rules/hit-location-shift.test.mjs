// test/rules/hit-location-shift.test.mjs — сдвиг места попадания (Военная зона).
import { describe, it, expect } from "vitest";
import { hasHitLocationShift } from "../../module/rules/hit-location-shift.mjs";
import { HOMEWORLDS } from "../../module/constants/homeworlds.mjs";

const item = (type, on) => ({ type, getFlag: (s, k) => (s === "warhammer-dbc" && k === "hitLocationShift" ? on : undefined) });

describe("hasHitLocationShift", () => {
  it("Черта, Талант и Родной мир с флагом разрешают сдвиг", () => {
    expect(hasHitLocationShift([item("trait", true)])).toBe(true);
    expect(hasHitLocationShift([item("talent", true)])).toBe(true);
    expect(hasHitLocationShift([item("homeworld", true)])).toBe(true);
  });
  it("без флага или у другого типа предмета — нет", () => {
    expect(hasHitLocationShift([item("homeworld", false), item("weapon", true)])).toBe(false);
    expect(hasHitLocationShift([])).toBe(false);
    expect(hasHitLocationShift(undefined)).toBe(false);
  });
  // wdbc-6rjtc.6: мир, выданный до флага, — предмет без hitLocationShift,
  // «Обновить мир» флаги не переносит. Признак — ключ мира в константах.
  it("Родной мир «Военная зона» без флага (персонаж до PR #530) — сдвиг есть", () => {
    const world = key => ({ type: "homeworld", system: { key }, getFlag: () => undefined });
    expect(hasHitLocationShift([world("warzone")])).toBe(true);
    expect(hasHitLocationShift([world("hive")])).toBe(false);
  });
  it("Военная зона в константах помечена, остальные миры — нет", () => {
    const marked = HOMEWORLDS.filter(h => h.hitLocationShift).map(h => h.key);
    expect(marked).toEqual(["warzone"]);
  });
});
