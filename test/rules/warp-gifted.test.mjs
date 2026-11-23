// Одарённый Варпом (Разобрать 9c9iu).
import { describe, it, expect } from "vitest";
import { warpGiftedRating, warpGiftedPowers, warpGiftedCastOpts } from "../../module/rules/warp-gifted.mjs";

const actor = (rating, powers) => ({ items: [
  { type: "trait", name: "Warp Gifted / Одарённый Варпом", system: { rating } },
  ...powers.map(([name, pr]) => ({ type: "psychicPower", name, system: { prRequired: pr } }))
] });

describe("Одарённый Варпом", () => {
  it("X из рейтинга Черты", () => {
    expect(warpGiftedRating(actor(3, []))).toBe(3);
    expect(warpGiftedRating({ items: [] })).toBe(0);
  });
  it("только силы ниже PR6", () => {
    expect(warpGiftedPowers(actor(2, [["Smite", 1], ["Big", 6]])).map(p => p.name)).toEqual(["Smite"]);
  });
  it("психотест: PR X, Обычный режим, флаг без Феноменов", () => {
    expect(warpGiftedCastOpts(4)).toMatchObject({ mPR: 4, mode: "normal", warpGifted: true });
  });
});
