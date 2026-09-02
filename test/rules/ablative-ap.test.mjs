// test/rules/ablative-ap.test.mjs
//
// wdbc-bxw6: общий примитив «−1 заряд за попадание» / «угасание на N» для
// трёх разных механик (мод «Аблативная», аблативный AP-щит Робы Чемпиона,
// аблативная Структура Минного Плуга) — см. module/rules/ablative-ap.mjs.

import { describe, it, expect } from "vitest";
import { ablativeApAfterHit, ablativeApAfterDecay } from "../../module/rules/ablative-ap.mjs";

describe("ablativeApAfterHit: ровно −1 за попадание, независимо от урона", () => {
  it("уменьшает на 1", () => expect(ablativeApAfterHit(5)).toBe(4));
  it("не уходит ниже нуля", () => expect(ablativeApAfterHit(0)).toBe(0));
  it("нечисловой вход считается нулём", () => expect(ablativeApAfterHit(undefined)).toBe(0));
});

describe("ablativeApAfterDecay: угасание на произвольную величину (1d5+1/Раунд)", () => {
  it("вычитает величину", () => expect(ablativeApAfterDecay(10, 4)).toBe(6));
  it("не уходит ниже нуля", () => expect(ablativeApAfterDecay(2, 5)).toBe(0));
  it("нечисловые входы считаются нулём", () => {
    expect(ablativeApAfterDecay(undefined, 3)).toBe(0);
    expect(ablativeApAfterDecay(5, undefined)).toBe(5);
  });
});
