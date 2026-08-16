// test/rules/talent-cost.test.mjs
//
// Цена Талантов. Обычно она берётся из таблицы «уровень × склонности», но у
// части Талантов книга называет число прямо: «Крепкое Телосложение — 100 ХР
// или 70 ХР при Покровительстве Нургла». Такой Талант считался как обычный
// первого уровня (150 / 250 / 400 XP) — то есть всегда неправильно.

import { describe, it, expect } from "vitest";
import { talentCostXP, fixedTalentCost, charAptitudeSet } from "../../module/constants/advancement.mjs";

const apts = charAptitudeSet(["t", "defence"]);   // обе склонности Крепкого Телосложения

describe("цена Таланта из книги", () => {
  it("Крепкое Телосложение стоит 100 всем, кроме нурглитов", () => {
    expect(fixedTalentCost("Sound Constitution / Крепкое Телосложение")).toBe(100);
    expect(fixedTalentCost("Sound Constitution / Крепкое Телосложение", "khorne")).toBe(100);
    expect(fixedTalentCost("Sound Constitution / Крепкое Телосложение", "nurgle")).toBe(70);
  });

  it("у прочих Талантов своей цены нет", () => {
    expect(fixedTalentCost("Ambidextrous / Амбидекстр")).toBeNull();
    expect(fixedTalentCost("")).toBeNull();
  });
});

describe("talentCostXP", () => {
  it("книжная цена перебивает и склонности, и культуру легиона", () => {
    const name = "Sound Constitution / Крепкое Телосложение";
    expect(talentCostXP(1, ["t", "defence"], apts, null,  { name })).toBe(100);
    expect(talentCostXP(1, [], charAptitudeSet([]), "enemy", { name })).toBe(100);
    expect(talentCostXP(1, [], charAptitudeSet([]), "enemy", { name, patron: "nurgle" })).toBe(70);
  });

  it("обычный Талант считается по таблице, как и раньше", () => {
    expect(talentCostXP(1, ["t", "defence"], apts)).toBe(150);          // Дружественный
    expect(talentCostXP(1, ["t"], apts)).toBe(250);                     // Нейтральный
    expect(talentCostXP(1, ["fieldcraft"], apts)).toBe(400);            // Враждебный
    expect(talentCostXP(2, ["t", "defence"], apts)).toBe(300);
  });

  it("имя без совпадения ничего не ломает", () => {
    expect(talentCostXP(1, ["t", "defence"], apts, null, { name: "Амбидекстр" })).toBe(150);
  });
});
