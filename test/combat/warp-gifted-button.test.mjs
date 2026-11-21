// test/combat/warp-gifted-button.test.mjs
//
// Sahara 584-daemonic. Одарённый Варпом: «тест W+5×X (или другую
// Характеристику/Навык, если те лучше подходят — по решению ГМа) … Трейт
// может иметь только персонаж с Трейтом Daemonic». Раньше оба пункта вёл стол.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";

const calls = [];
vi.mock("../../module/sheets/tabs/psychic.mjs", () => ({
  executePsychotest: async (actor, power, opts) => { calls.push({ power: power.name, opts }); }
}));

const { useWarpGifted } = await import("../../module/combat/warp-gifted.mjs");
const { warpGiftedAllowed, warpGiftedCastOpts } = await import("../../module/rules/warp-gifted.mjs");

const actor = ({ daemonic = true, type = "character" } = {}) => ({
  name: "Демон", type, items: [
    { type: "trait", name: "Warp Gifted / Одарённый Варпом", system: { rating: 2 } },
    ...(daemonic ? [{ type: "trait", name: "Daemonic / Демонический (2)", system: { rating: 2 } }] : []),
    { id: "p1", type: "psychicPower", name: "Smite", system: { prRequired: 1 } }
  ]
});

beforeEach(() => { resetCaptured(); calls.length = 0; });

describe("Одарённый Варпом: Daemonic и Характеристика теста", () => {
  it("носитель Daemonic или демон — можно; иначе нет", () => {
    expect(warpGiftedAllowed(actor())).toBe(true);
    expect(warpGiftedAllowed(actor({ daemonic: false }))).toBe(false);
    expect(warpGiftedAllowed(actor({ daemonic: false, type: "daemon" }))).toBe(true);
  });

  it("опции психотеста несут выбранную Характеристику", () => {
    expect(warpGiftedCastOpts(3, "ag")).toMatchObject({ mPR: 3, castChar: "ag", warpGifted: true });
    expect(warpGiftedCastOpts(3).castChar).toBe("wp");
  });

  it("окно: выбранная ГМом Характеристика уходит в психотест", async () => {
    const run = useWarpGifted(actor());
    await Promise.resolve();
    await captured.press("ok", fakeForm({ "[name=power]": "p1", "[name=castChar]": "per" }));
    expect(await run).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toMatchObject({ mPR: 2, castChar: "per", warpGifted: true });
  });

  it("без Daemonic: спрашивает; «нет» — психотеста нет", async () => {
    captured.confirmAnswer = false;
    expect(await useWarpGifted(actor({ daemonic: false }))).toBe(false);
    expect(captured.dialog?.content ?? "").toMatch(/Daemonic/);
    expect(calls).toEqual([]);
  });
});
