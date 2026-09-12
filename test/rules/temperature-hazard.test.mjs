// test/rules/temperature-hazard.test.mjs
//
// Тест на Жару/Холод (wdbc-1rno) — перевод частоты книги в секунды
// кулдауна. Сам ролл/Усталость/иммунитет Бриза — module/combat/
// temperature-hazard.mjs, интеграционные тесты там же.

import { describe, it, expect } from "vitest";
import { tempHazardIntervalSeconds } from "../../module/rules/temperature-hazard.mjs";

describe("tempHazardIntervalSeconds", () => {
  it("каждый Ход — длина Раунда (6 секунд)", () => {
    expect(tempHazardIntervalSeconds("каждый Ход")).toBe(6);
  });

  it("минуты/часы книги переведены верно", () => {
    expect(tempHazardIntervalSeconds("каждую минуту")).toBe(60);
    expect(tempHazardIntervalSeconds("раз в 5 минут")).toBe(300);
    expect(tempHazardIntervalSeconds("раз в 30 минут")).toBe(1800);
    expect(tempHazardIntervalSeconds("каждый час")).toBe(3600);
    expect(tempHazardIntervalSeconds("раз в 2 часа")).toBe(7200);
    expect(tempHazardIntervalSeconds("раз в 4 часа")).toBe(14400);
    expect(tempHazardIntervalSeconds("раз в 8 часов")).toBe(28800);
  });

  it("незнакомая/пустая строка частоты — null, не 0 и не падает", () => {
    expect(tempHazardIntervalSeconds("что-то новое")).toBeNull();
    expect(tempHazardIntervalSeconds("")).toBeNull();
    expect(tempHazardIntervalSeconds(undefined)).toBeNull();
  });
});
