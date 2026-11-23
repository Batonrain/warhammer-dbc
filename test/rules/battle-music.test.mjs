// Музыка Воина Ноты: Ария, Увертюра, Симфония (20.11.2026).
import { describe, it, expect } from "vitest";
import { musicMark, musicDeg, symphonyProps, ariaWeaponOk } from "../../module/rules/battle-music.mjs";

const withFlag = f => ({ flags: { "warhammer-dbc": { hearingMusic: f } } });

describe("музыка", () => {
  it("Ария живёт до следующего Хода, Увертюра — Раунд", () => {
    const c = { id: "c", round: 2 };
    const aria = withFlag(musicMark(7, c, { rounds: 1 }));
    expect(musicDeg(aria, { combat: c })).toBe(7);
    expect(musicDeg(aria, { combat: { id: "c", round: 3 } })).toBe(7);
    expect(musicDeg(aria, { combat: { id: "c", round: 4 } })).toBe(0);
    const ov = withFlag(musicMark(5, c, { rounds: 0 }));
    expect(musicDeg(ov, { combat: { id: "c", round: 3 } })).toBe(0);
  });
  it("вне боя — минута", () => {
    const a = withFlag(musicMark(6, null, { now: 100 }));
    expect(musicDeg(a, { now: 150 })).toBe(6);
    expect(musicDeg(a, { now: 200 })).toBe(0);
  });
  it("Симфония: 6+ Успехов, рукопашная или метательная", () => {
    expect(symphonyProps(8, { isMelee: true })).toEqual([{ key: "felling", rating: 3, rating2: 0 }, { key: "precise" }]);
    expect(symphonyProps(5, { isMelee: true })).toEqual([]);
    expect(symphonyProps(8, { isMelee: false })).toEqual([]);
    expect(symphonyProps(6, { thrown: true })[0].rating).toBe(1);
  });
  it("Ария: клинок с Балансом от 0", () => {
    const blade = b => ({ type: "weapon", system: { balance: b } });
    expect(ariaWeaponOk(blade(0), () => true)).toBe(true);
    expect(ariaWeaponOk(blade(-1), () => true)).toBe(false);
    expect(ariaWeaponOk(blade(1), () => false)).toBe(false);
  });
});
