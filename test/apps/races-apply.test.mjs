// test/apps/races-apply.test.mjs
//
// Применение расы: носитель на акторе + выдача Конструктора + ключ-зеркало.
// Числа Черт здесь не проверяются — их считает актор из самих Черт; проверяется
// то, что делает именно применение.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { raceCharsUpdate } from "../../module/apps/races.mjs";

const chars = over => ({
  ws: { base: 0 }, bs: { base: 0 }, s: { base: 0 }, t: { base: 0 }, ag: { base: 0 },
  int: { base: 0 }, per: { base: 0 }, wp: { base: 0 }, fel: { base: 0 }, inf: { base: 0 },
  ...over
});

describe("стартовые характеристики расы", () => {

  it("пустые поля заполняются значениями расы", () => {
    const actor = { system: { characteristics: chars() } };

    expect(raceCharsUpdate(actor, { ws: 30, bs: 30 })).toEqual({
      "system.characteristics.ws.base": 30,
      "system.characteristics.bs.base": 30
    });
  });

  // Заполненное поле — это уже выбор игрока или бросок Мастера. Молча затирать
  // его нельзя: раса даёт основу, а не переписывает готового персонажа.
  it("заполненные поля не трогаются", () => {
    const actor = { system: { characteristics: chars({ ws: { base: 41 } }) } };

    expect(raceCharsUpdate(actor, { ws: 30, bs: 30 })).toEqual({
      "system.characteristics.bs.base": 30
    });
  });

  it("характеристики, которых у расы нет, не появляются", () => {
    const actor = { system: { characteristics: chars() } };

    expect(raceCharsUpdate(actor, {})).toEqual({});
  });
});
