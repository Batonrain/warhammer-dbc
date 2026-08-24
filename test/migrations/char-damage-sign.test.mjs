// test/migrations/char-damage-sign.test.mjs
//
// Поле charDamage сменило смысл: было «Урон в характеристику» (плюс = штраф,
// вычиталось), стало знаковым «Мод.» (прибавляется). Миграция обязана обратить
// знак сохранённых значений — иначе старый штраф 10 превращается в бонус +10 —
// и не плодить пустых обновлений там, где всё по нулям.

import { describe, it, expect } from "vitest";
import { charDamageSignUpdate } from "../../module/migrations/char-damage-sign.mjs";

describe("инверсия знака Мод. характеристик", () => {
  it("положительный штраф старого мира становится отрицательным Мод.", () => {
    expect(charDamageSignUpdate({ charDamage: { s: 10, t: 5, ws: 0 } })).toEqual({
      "system.charDamage.s": -10,
      "system.charDamage.t": -5
    });
  });

  it("нули и отсутствие поля не рождают обновления", () => {
    expect(charDamageSignUpdate({ charDamage: { s: 0, t: 0 } })).toEqual({});
    expect(charDamageSignUpdate({})).toEqual({});
  });

  it("инверсия симметрична (повторный запуск гейтится версией настройки)", () => {
    expect(charDamageSignUpdate({ charDamage: { s: -10 } })).toEqual({
      "system.charDamage.s": 10
    });
  });
});
