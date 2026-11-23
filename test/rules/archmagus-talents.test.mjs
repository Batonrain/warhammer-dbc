// Архимаг: чистая часть Талантов (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  exemptusMod, innerEyeDeg, innerEyeState, unlimitedPowerResult, savantAllowed, mirrorSoulCost,
  staffQualityBonus, hasMagusSupreme
} from "../../module/rules/archmagus-talents.mjs";

const NS = "warhammer-dbc";

describe("Архимаг", () => {
  it("Экземптус: −60, лично −30, +5 за кубик выжигания", () => {
    expect(exemptusMod()).toBe(-60);
    expect(exemptusMod({ personal: true })).toBe(-30);
    expect(exemptusMod({ personal: true, burnDice: 3 })).toBe(-15);
    expect(exemptusMod({ personal: false, burnDice: 3 })).toBe(-60);
  });
  it("Внутренний Глаз: ±1 Успех за каждые полные 10, не меньше 1", () => {
    expect(innerEyeDeg(3, 0)).toBe(3);
    expect(innerEyeDeg(3, 25)).toBe(5);
    expect(innerEyeDeg(3, -19)).toBe(2);
    expect(innerEyeDeg(2, -40)).toBe(1);
  });
  it("Внутренний Глаз: действует до конца своего боя или своей сцены", () => {
    const a = { flags: { [NS]: { innerEye: { deg: 2, combatId: "c1", sceneId: "s1" } } } };
    expect(innerEyeState(a, { combatId: "c1", sceneId: "s1" })?.deg).toBe(2);
    expect(innerEyeState(a, { combatId: "c2", sceneId: "s1" })).toBe(null);
    const b = { flags: { [NS]: { innerEye: { deg: 2, combatId: null, sceneId: "s1" } } } };
    expect(innerEyeState(b, { combatId: null, sceneId: "s1" })?.deg).toBe(2);
    expect(innerEyeState(b, { combatId: null, sceneId: "s2" })).toBe(null);
  });
  it("Безграничная Сила: ×3, минус защита, /3 вверх, Провалы противника не делятся", () => {
    expect(unlimitedPowerResult({ mine: 3, oppSuccesses: 4 })).toMatchObject({ tripled: 9, remaining: 5, final: 2 });
    expect(unlimitedPowerResult({ mine: 2, oppFailures: 2 })).toMatchObject({ final: 4 });
    expect(unlimitedPowerResult({ mine: 1, oppSuccesses: 5 }).won).toBe(false);
  });
  it("Савант Имматериал: вторая сила не дороже половины", () => {
    expect(savantAllowed(400, 200)).toBe(true);
    expect(savantAllowed(400, 201)).toBe(false);
    expect(savantAllowed(0, 0)).toBe(false);
  });
  it("Зеркальная Душа: копия несёт поддержание помеченных сил", () => {
    const pw = (cost, flags = {}) => ({ type: "psychicPower", system: { isSustained: true, sustainCost: cost }, flags: { [NS]: flags } });
    const actor = { items: [{ type: "talent", name: "Mirror Soul / Зеркальная Душа" }, pw(2, { mirrorSoul: true }), pw(1), pw(3, { mirrorSoul: true, woundFree: true })] };
    expect(mirrorSoulCost(actor)).toBe(2);
    expect(mirrorSoulCost({ items: actor.items.slice(1) })).toBe(0);
  });
  it("Чародейский Посох: Good +5, Best +10", () => {
    expect(staffQualityBonus("good")).toBe(5);
    expect(staffQualityBonus("best")).toBe(10);
    expect(staffQualityBonus("common")).toBe(0);
    expect(hasMagusSupreme({ items: [{ type: "trait", name: "Magus Supreme / Высший Магус" }] })).toBe(true);
  });
});
