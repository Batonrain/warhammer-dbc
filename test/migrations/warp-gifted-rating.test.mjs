// test/migrations/warp-gifted-rating.test.mjs
//
// Приёмка #597: в паке «Одарённый Варпом» получил hasRating:true, у выданных
// раньше копий hasRating:false — поля X на листе нет, кнопка просит вписать
// рейтинг, который вписать некуда.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { warpGiftedRatingFix } from "../../module/migrations/warp-gifted-rating.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const trait = (name, system = {}) => ({ id: "T1", type: "trait", name, system: { hasRating: false, rating: 0, ...system } });

describe("«Одарённый Варпом»: Рейтинг у старых копий", () => {
  it("в паке Черта несёт hasRating — копии догоняют её", () => {
    const doc = allPackDocuments("traits").map(d => d.doc).find(d => d.name.startsWith("Warp Gifted /"));
    expect(doc.system.hasRating).toBe(true);
  });

  it("копия без числа в имени — включается Рейтинг, число не выдумывается", () => {
    expect(warpGiftedRatingFix(trait("Warp Gifted / Одарённый Варпом"))).toEqual({ _id: "T1", "system.hasRating": true });
  });

  it("X из названия «(X)»", () => {
    expect(warpGiftedRatingFix(trait("Warp Gifted (3) / Одарённый Варпом (3)")))
      .toEqual({ _id: "T1", "system.hasRating": true, "system.rating": 3 });
  });

  it("число на предмете главнее имени", () => {
    expect(warpGiftedRatingFix(trait("Warp Gifted (3)", { rating: 2 }))).toEqual({ _id: "T1", "system.hasRating": true });
  });

  it("идемпотентно и не та Черта — null", () => {
    expect(warpGiftedRatingFix(trait("Warp Gifted / Одарённый Варпом", { hasRating: true }))).toBe(null);
    expect(warpGiftedRatingFix(trait("Nimble / Проворный"))).toBe(null);
    expect(warpGiftedRatingFix({ type: "talent", name: "Warp Gifted", system: {} })).toBe(null);
  });
});
