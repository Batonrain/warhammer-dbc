// Психический Локус (Разобрать o2964).
import { describe, it, expect } from "vitest";
import { locusUsable, locusRangeM } from "../../module/rules/psychic-locus.mjs";

const psyker = (successes = 3) => ({
  items: [{ type: "talent", name: "Psychic Locus / Психический Локус" }],
  system: { characteristics: { per: { bonus: 4 } } },
  flags: { "warhammer-dbc": { psychicLocus: { sceneId: "s1", x: 0, y: 0, successes } } }
});

describe("Психический Локус", () => {
  it("радиус P.b×100 м", () => expect(locusRangeM(psyker())).toBe(400));
  it("рядом — Феномен −Успехи×5", () => {
    expect(locusUsable(psyker(3), { sceneId: "s1", distanceM: 120 })).toEqual({ ok: true, reduction: 15, reason: "" });
  });
  it("дальше радиуса, другая сцена, исчерпан — нельзя", () => {
    expect(locusUsable(psyker(3), { sceneId: "s1", distanceM: 401 }).ok).toBe(false);
    expect(locusUsable(psyker(3), { sceneId: "s2", distanceM: 0 }).ok).toBe(false);
    expect(locusUsable(psyker(0), { sceneId: "s1", distanceM: 0 }).ok).toBe(false);
  });
});
