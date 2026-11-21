// Коготь Варпа: Разрыватель Завесы, Стервятник, Разлом, Варп-След (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  corBonus, veilRenderItem, inWarp, riftDice, riftSummons, riftHits, warpTrailMod, veilRenderPayOptions
} from "../../module/rules/warp-talon-talents.mjs";

const veil = (activated = false) => ({ type: "trait", name: "Veil Render / Разрыватель Завесы",
  flags: activated ? { "warhammer-dbc": { activated: { combatId: "", at: 0 } } } : {} });

describe("Разрыватель Завесы", () => {
  it("в Варпе — пока Черта включена", () => {
    expect(inWarp({ items: [veil(true)] })).toBe(true);
    expect(inWarp({ items: [veil(false)] })).toBe(false);
    expect(inWarp({ items: [] })).toBe(false);
    expect(veilRenderItem({ items: [{ type: "talent", name: "Veil Render" }] })).toBe(null);
  });
  it("оплата: Бесчестие и/или Стервятник, только то, что есть", () => {
    expect(veilRenderPayOptions({ infamy: 2, vulture: 1 }).map(o => o.id)).toEqual(["infamy", "vulture"]);
    expect(veilRenderPayOptions({ infamy: 0, vulture: 1 }).map(o => o.id)).toEqual(["vulture"]);
    expect(veilRenderPayOptions({})).toEqual([]);
  });
});

describe("Разлом", () => {
  it("½Cor.b (окр.▲) d10, радиус Cor.b", () => {
    const a = { system: { corruptionBonus: 5 } };
    expect(riftDice(a)).toBe(3);
    expect(corBonus(a)).toBe(5);
  });
  it("две одинаковые 6/7/8/9 — призыв, прочие пары — нет", () => {
    expect(riftSummons([6, 6, 3])).toEqual([{ face: 6, daemon: "Демонетки" }]);
    expect(riftSummons([9, 2, 9, 8, 8])).toEqual([{ face: 8, daemon: "Кровопускатели" }, { face: 9, daemon: "Ужасы" }]);
    expect(riftSummons([10, 10, 5, 5])).toEqual([]);
  });
  it("Daemonic не задевает", () => {
    expect(riftHits({ items: [{ type: "trait", name: "Daemonic / Демонический (X)" }] })).toBe(false);
    expect(riftHits({ items: [] })).toBe(true);
  });
});

describe("Варп-След", () => {
  it("−30, +5×PR псайкера", () => {
    expect(warpTrailMod(null)).toBe(-30);
    expect(warpTrailMod({ system: { psyker: { rating: 4 } } })).toBe(-10);
  });
});
