// test/apps/infamy-points-value.test.mjs
//
// actorInfamyValue (wdbc-lfho): диалог Страха раньше просил игрока вписать
// Infamy руками с дефолтом 0, что тихо отключало авто-успех «Infamy ≥ X» у
// персонажей, у которых Очки Бесчестия реально накоплены. Функция читает тот
// же путь, что и лист (actor-sheet.mjs `_infamyPath` / demon-prince-sheet.mjs
// override), но по типу актора — без класса листа.

import { describe, it, expect } from "vitest";
import { actorInfamyValue } from "../../module/apps/infamy-points.mjs";

describe("actorInfamyValue", () => {
  it("обычный/Хаосит — system.fate.value", () => {
    expect(actorInfamyValue({ type: "character", system: { fate: { value: 3 } } })).toBe(3);
  });

  it("Демон-Принц — system.dp.ip, а не fate.value", () => {
    const actor = { type: "demonPrince", system: { fate: { value: 9 }, dp: { ip: 2 } } };
    expect(actorInfamyValue(actor)).toBe(2);
  });

  it("отрицательное/нечисловое значение клампится в 0", () => {
    expect(actorInfamyValue({ type: "character", system: { fate: { value: -5 } } })).toBe(0);
    expect(actorInfamyValue({ type: "character", system: {} })).toBe(0);
    expect(actorInfamyValue({ type: "character" })).toBe(0);
  });
});
