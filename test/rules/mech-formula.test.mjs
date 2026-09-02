// test/rules/mech-formula.test.mjs
//
// mechFormulaTotal/mechRollData — формулы полей «Значение»/«Рейтинг»
// Конструктора МЕХАНИКА над бонусами Характеристик (см. чат: «А можем мы
// позволить полям Конструктора выдавать рейтинг, равный формуле»). Примеры —
// прямо из книги: «Flyer (A.b×2)» (Крылья), «Natural Armour (½Cor.b, окр.▲)»
// (Панцирь), «Natural Armour (½Cor.b, окр.▼)» (Ящер, субмутация «Животного
// Гибрида»).

import { describe, it, expect } from "vitest";
import { mechFormulaTotal, mechFormulaTotalSafe, mechRollData } from "../../module/rules/mech-formula.mjs";

const rd = { ws: 3, bs: 4, s: 5, t: 6, ag: 7, int: 8, per: 9, wp: 10, fel: 11, inf: 2, cor: 9, pr: 7 };

describe("mechRollData", () => {
  it("бонусы характеристик + Cor.b короткими ключами книги", () => {
    const actor = {
      system: {
        characteristics: { ag: { bonus: 4 }, s: { bonus: 3 } },
        corruptionBonus: 5
      }
    };
    expect(mechRollData(actor)).toMatchObject({ ag: 4, s: 3, cor: 5, pr: 0 });
  });

  it("нет актора/полей — нули, не падает", () => {
    expect(mechRollData(null)).toMatchObject({ ws: 0, cor: 0, pr: 0 });
    expect(mechRollData({})).toMatchObject({ ws: 0, cor: 0, pr: 0 });
  });

  it("pr — Пси-Рейтинг (system.psyker.rating, wdbc-173l: Godkin/Muscle Mass)", () => {
    const actor = { system: { psyker: { rating: 7 } } };
    expect(mechRollData(actor)).toMatchObject({ pr: 7 });
  });
});

describe("mechFormulaTotal", () => {
  it("голое число — как раньше", () => {
    expect(mechFormulaTotal("5", rd)).toBe(5);
    expect(mechFormulaTotal("-3", rd)).toBe(-3);
    expect(mechFormulaTotal("", rd)).toBe(0);
  });

  it("Flyer (A.b×2) — «Крылья»", () => {
    expect(mechFormulaTotal("ag*2", rd)).toBe(14);
  });

  it("Natural Armour (½Cor.b, окр.▲) — «Панцирь»", () => {
    expect(mechFormulaTotal("ceil(cor/2)", rd)).toBe(5); // 9/2 = 4.5 → 5
  });

  it("Natural Armour (½Cor.b, окр.▼) — «Ящер»", () => {
    expect(mechFormulaTotal("floor(cor/2)", rd)).toBe(4); // 9/2 = 4.5 → 4
  });

  it("сложное выражение с плюсом и скобками", () => {
    expect(mechFormulaTotal("s + ceil(cor/3)", rd)).toBe(8); // 5 + ceil(3) = 5+3
  });

  it("результат всегда целый (дробная часть отбрасывается)", () => {
    expect(mechFormulaTotal("cor/2", rd)).toBe(4); // 4.5 → усечение к 4 (не round)
  });

  it("неизвестный символ — бросает, не тихий 0", () => {
    expect(() => mechFormulaTotal("cor + alert(1)", rd)).toThrow();
    expect(() => mechFormulaTotal("cor; while(true){}", rd)).toThrow();
    expect(() => mechFormulaTotal("cor.constructor", rd)).toThrow(); // точка после подстановки не разрешена
  });

  it("mechFormulaTotalSafe глотает ошибку формулы, отдаёт 0", () => {
    expect(mechFormulaTotalSafe("cor + alert(1)", rd)).toBe(0);
  });

  it("регистр не важен — 'AG*2' работает как 'ag*2'", () => {
    expect(mechFormulaTotal("AG*2", rd)).toBe(14);
  });

  it("каноническая нотация «X.b» (resolveCharFormula) — наравне с короткими ключами", () => {
    expect(mechFormulaTotal("Cor.b", rd)).toBe(9);
    expect(mechFormulaTotal("WS.b", rd)).toBe(3);
    expect(mechFormulaTotal("ceil(Cor.b/2)", rd)).toBe(5);   // как ceil(cor/2)
    expect(mechFormulaTotal("A.b*2", rd)).toBe(14);          // однобуквенный алиас Ag
    expect(mechFormulaTotal("ws.b + s", rd)).toBe(8);        // регистр не важен, смешение допустимо
  });

  it("голое число с точкой сохраняет дробь — 0.5 кг Веса это 0.5, не 0", () => {
    expect(mechFormulaTotal("0.5", rd)).toBe(0.5);
    expect(mechFormulaTotal("-1.5", rd)).toBe(-1.5);
  });

  it("pr — «+3×PR аблативных Ран» (Godkin) и «PR» (Muscle Mass)", () => {
    expect(mechFormulaTotal("pr*3", rd)).toBe(21);
    expect(mechFormulaTotal("pr", rd)).toBe(7);
  });
});
