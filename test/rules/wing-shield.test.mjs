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

  // Прежний тест требовал здесь ratingMax: 0 — и закреплял потерю данных.
  // Штатный порядок действий навязан самим листом: поля книжных рейтингов
  // раньше показывались ТОЛЬКО после выбора положения, то есть первый же
  // выбор писал ноль поверх уже выставленного рейтинга, и вернуть прежнее
  // число было нечем (приём стопки #478-#481, 14.09.2026).
  it("рейтинг положения не заполнен — ratingMax не трогается вовсе", () => {
    expect(wingPositionShieldUpdate("folded")).toEqual({
      "system.shield.wingPosition": "folded"
    });
    expect(wingPositionShieldUpdate("wrapped", { wingRatingFolded: 75 })).toEqual({
      "system.shield.wingPosition": "wrapped"
    });
  });

  // Бросок щита катается против currentRating (combat/shield.mjs), а тот
  // заполняется из ratingMax только при ВКЛЮЧЕНИИ щита. Без синхронизации
  // лист показывал новое число, а кубик катился против старого.
  it("щит включён — смена положения меняет и текущий рейтинг, не только максимум", () => {
    expect(wingPositionShieldUpdate("wrapped",
      { wingRatingFolded: 75, wingRatingWrapped: 40, status: "active" })).toEqual({
      "system.shield.wingPosition": "wrapped",
      "system.shield.ratingMax": 40,
      "system.shield.enabled": true,
      "system.shield.currentRating": 40
    });
  });

  it("щит выключен — текущий рейтинг не выставляется (его задаст включение)", () => {
    expect(wingPositionShieldUpdate("wrapped",
      { wingRatingWrapped: 40, status: "inactive" }))
      .not.toHaveProperty("system.shield.currentRating");
  });
});
