// Чернокнижник: гейт Тёмных Искусств, Варп-Танцор, Высший Ритуалист (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { darkArtsGate, warpDanceOutcome, highRitualistKey, silentStudentNeed } from "../../module/rules/warlock-talents.mjs";

const NS = "warhammer-dbc";
const DA = { type: "trait", name: "Dark Arts / Тёмные Искусства" };
const WD = { type: "talent", name: "Warp Dancer / Варп-Танцор" };
const warlock = (items = [], flags = {}) => ({ items: [DA, ...items], flags: { [NS]: flags },
  system: { characteristics: { wp: { total: 40 }, per: { total: 35 }, int: { total: 50 } } } });

describe("Тёмные Искусства", () => {
  it("только Пути Силы и Обычный режим, без реакций", () => {
    expect(darkArtsGate(warlock(), { path: "sacrifice", mode: "normal" }).ok).toBe(true);
    expect(darkArtsGate(warlock(), { path: "", mode: "normal" }).ok).toBe(false);
    expect(darkArtsGate(warlock(), { path: "psychofocus", mode: "normal" }).ok).toBe(false);
    expect(darkArtsGate(warlock(), { path: "meditation", mode: "push" }).ok).toBe(false);
    expect(darkArtsGate(warlock(), { path: "meditation", mode: "normal", action: "reaction" }).ok).toBe(false);
    expect(darkArtsGate({ items: [] }, { path: "", mode: "push" }).ok).toBe(true);
  });
  it("Маг-Каннибал / Последнее Эхо снимают ограничения", () => {
    expect(darkArtsGate(warlock([], { darkArtsFree: { turns: 2, source: "echo" } }), { path: "", mode: "push" }).ok).toBe(true);
  });
  it("Варп-Танцор: без Пути и реакции — можно, двумя бросками", () => {
    expect(darkArtsGate(warlock([WD]), { path: "", mode: "normal" })).toMatchObject({ ok: true, warpDance: true });
    expect(darkArtsGate(warlock([WD]), { path: "unholy", mode: "normal", action: "reaction" })).toMatchObject({ ok: true, warpDance: true });
    expect(darkArtsGate(warlock([WD]), { path: "unholy", mode: "normal" })).toMatchObject({ ok: true, warpDance: false });
    expect(darkArtsGate(warlock([WD]), { path: "", mode: "push" }).ok).toBe(false);
  });
  it("Варп-Танцор: худший из двух", () => {
    expect(warpDanceOutcome({ success: true, deg: 4 }, { success: true, deg: 2 })).toEqual({ success: true, deg: 2 });
    expect(warpDanceOutcome({ success: true, deg: 4 }, { success: false, deg: 1 })).toEqual({ success: false, deg: 1 });
    expect(warpDanceOutcome({ success: false, deg: 3 }, { success: false, deg: 2 })).toEqual({ success: false, deg: 3 });
  });
  it("Высший Ритуалист: I вместо W/P, если выше", () => {
    const a = warlock([{ type: "talent", name: "High Ritualist / Высший Ритуалист" }]);
    expect(highRitualistKey(a, "wp")).toBe("int");
    expect(highRitualistKey(a, "fel")).toBe("fel");
    expect(highRitualistKey(warlock(), "wp")).toBe("wp");
  });
  it("Тихий Ученик: цена ÷50 вверх", () => {
    expect(silentStudentNeed(300)).toBe(6);
    expect(silentStudentNeed(120)).toBe(3);
  });
});
