// Эгида Воли (Разобрать o2964).
import { describe, it, expect } from "vitest";
import { aegisLimit, aegisApplies, applyAegisExclusion, psykerRatingOf } from "../../module/rules/aegis-of-will.mjs";

const caster = (pr, talents = ["Aegis of Will / Эгида Воли"]) => ({
  system: { psyker: { rating: pr } }, items: talents.map(name => ({ type: "talent", name, system: {} }))
});
describe("Эгида Воли", () => {
  it("½PR с округлением вверх", () => {
    expect(aegisLimit(3)).toBe(2);
    expect(aegisLimit(4)).toBe(2);
    expect(aegisLimit(0)).toBe(0);
    expect(psykerRatingOf({ system: { psyker: { rating: 3, currentRating: 5 } } })).toBe(5);
  });
  it("только психосила и только с Талантом", () => {
    expect(aegisApplies(caster(3), { type: "psychicPower" })).toBe(true);
    expect(aegisApplies(caster(3), { type: "weapon" })).toBe(false);
    expect(aegisApplies(caster(3, []), { type: "psychicPower" })).toBe(false);
    expect(aegisApplies(caster(0), { type: "psychicPower" })).toBe(false);
  });
  it("исключает не больше лимита", () => {
    const toks = ["a", "b", "c"].map(id => ({ id }));
    expect(applyAegisExclusion(toks, ["a", "b"], 1).map(t => t.id)).toEqual(["b", "c"]);
    expect(applyAegisExclusion(toks, [], 2)).toHaveLength(3);
  });
});
