// Психический Локус: расстояние меряется по placeable-токену с .center (живая проверка pr-584-locus-center).
import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { locusHere } from "../../module/combat/psychic-locus.mjs";

const prevCanvas = globalThis.canvas;
afterEach(() => { globalThis.canvas = prevCanvas; });

describe("locusHere", () => {
  it("берёт placeable (getActiveTokens(false)), а не TokenDocument", () => {
    globalThis.canvas = { ready: true, scene: { id: "s" }, dimensions: { size: 100, distance: 1 } };
    const placeable = { center: { x: 300, y: 400 } };
    const docOnly = {};   // у TokenDocument нет .center
    const actor = {
      getActiveTokens: (linked, document) => [document ? docOnly : placeable],
      flags: { "warhammer-dbc": { psychicLocus: { sceneId: "s", x: 0, y: 0, successes: 2 } } },
      getFlag: (ns, k) => actor.flags[ns]?.[k]
    };
    expect(locusHere(actor)).toEqual({ sceneId: "s", distanceM: 5 });
  });
});
