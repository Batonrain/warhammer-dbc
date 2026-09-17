// test/combat/apply-damage-dice-mods.test.mjs
//
// applyDamageDiceMods (module/combat/weapon-properties.mjs) — чистая
// строковая трансформация формулы урона: Рвущее (+1 кубик, kh), Проверенное
// (min на кубике), и Backstab/Удар в Спину (wdbc-1rno.2) — doubleDice,
// удваивает число кубиков («нож 1d5 → 2d5»).

import { describe, it, expect } from "vitest";
import { applyDamageDiceMods } from "../../module/combat/weapon-properties.mjs";

const auto = (over = {}) => ({ tearing: false, provenRating: 0, doubleDice: false, ...over });

describe("applyDamageDiceMods", () => {
  it("без свойств — формула не меняется", () => {
    expect(applyDamageDiceMods("1d10+4", auto())).toBe("1d10+4");
  });

  it("doubleDice — удваивает число кубиков, остальное формулы не трогает", () => {
    expect(applyDamageDiceMods("1d5", auto({ doubleDice: true }))).toBe("2d5");
    expect(applyDamageDiceMods("1d10+4", auto({ doubleDice: true }))).toBe("2d10+4");
  });

  it("doubleDice на формуле с несколькими кубиками — удваивает исходное число", () => {
    expect(applyDamageDiceMods("2d10+2", auto({ doubleDice: true }))).toBe("4d10+2");
  });

  it("Рвущее (tearing) — +1 кубик, keep-highest исходного числа", () => {
    expect(applyDamageDiceMods("1d10", auto({ tearing: true }))).toBe("2d10kh1");
  });

  it("Проверенное (provenRating) — min на кубике", () => {
    expect(applyDamageDiceMods("1d10", auto({ provenRating: 8 }))).toBe("1d10min8");
  });

  it("Рвущее + doubleDice вместе — doubleDice удваивает УЖЕ увеличенное Рвущим число, kh держит исходное n", () => {
    // Задокументированный выбор порядка операций (см. комментарий в коде) —
    // редкое сочетание, книга явно не разбирает.
    expect(applyDamageDiceMods("1d10", auto({ tearing: true, doubleDice: true }))).toBe("4d10kh1");
  });

  it("формула без кубика (голое число/только модификатор) — не трогается", () => {
    expect(applyDamageDiceMods("5", auto({ doubleDice: true }))).toBe("5");
  });

  it("пустая/null формула — не бросает", () => {
    expect(applyDamageDiceMods("", auto({ doubleDice: true }))).toBe("");
    expect(applyDamageDiceMods(null, auto({ doubleDice: true }))).toBe("");
  });
});
