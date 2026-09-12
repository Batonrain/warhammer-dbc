// test/rules/wing-shield.test.mjs
//
// Положение Крыльев импланта (wdbc-lmd2, найдено внутри wdbc-q0q8): смена
// положения подставляет книжный рейтинг щита-дефлектора ЭТОГО предмета в
// ratingMax и включает/выключает поле — чистый расчёт, без Foundry.

import { describe, it, expect } from "vitest";
import { wingPositionShieldUpdate } from "../../module/rules/wing-shield.mjs";

describe("wingPositionShieldUpdate", () => {
  it("сложены (folded) — ratingMax берёт wingRatingFolded, поле включается", () => {
    expect(wingPositionShieldUpdate("folded", { wingRatingFolded: 75, wingRatingWrapped: 40 })).toEqual({
      "system.shield.wingPosition": "folded",
      "system.shield.ratingMax": 75,
      "system.shield.enabled": true
    });
  });

  it("окутывают (wrapped) — ratingMax берёт wingRatingWrapped, поле включается", () => {
    expect(wingPositionShieldUpdate("wrapped", { wingRatingFolded: 75, wingRatingWrapped: 40 })).toEqual({
      "system.shield.wingPosition": "wrapped",
      "system.shield.ratingMax": 40,
      "system.shield.enabled": true
    });
  });

  it("расправлены (flying) — поле выключается целиком, рейтинг не трогаем", () => {
    expect(wingPositionShieldUpdate("flying", { wingRatingFolded: 75, wingRatingWrapped: 40 })).toEqual({
      "system.shield.wingPosition": "flying",
      "system.shield.enabled": false,
      "system.shield.status": "inactive",
      "system.shield.currentRating": 0
    });
  });

  it("пусто (не Крылья) — трогает только саму позицию", () => {
    expect(wingPositionShieldUpdate("", { wingRatingFolded: 75, wingRatingWrapped: 40 })).toEqual({
      "system.shield.wingPosition": ""
    });
  });

  it("без переданных рейтингов — не падает, подставляет 0", () => {
    expect(wingPositionShieldUpdate("folded")).toEqual({
      "system.shield.wingPosition": "folded",
      "system.shield.ratingMax": 0,
      "system.shield.enabled": true
    });
  });
});
