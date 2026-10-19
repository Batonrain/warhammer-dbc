// test/rules/patron-infamy.test.mjs
//
// wdbc-8rwyw. Покровительство (корбук 438): Нургл «Принятие Судьбы» — не может
// «Переброс»; Тзинч «Безумная Гордыня» — не может «Усиление»; запрет действует
// у Хаоситов и на меню Очков карточки броска.

import { describe, it, expect } from "vitest";
import { patronBlocksInfamyAbility } from "../../module/rules/patron-infamy.mjs";

const hero = (patronGod, alignment = "heretic") => ({ system: { alignment, patronGod } });

describe("patronBlocksInfamyAbility", () => {
  it("Нургл не может Переброс, но может Усиление", () => {
    expect(patronBlocksInfamyAbility(hero("nurgle"), "reroll")).toContain("Принятие Судьбы");
    expect(patronBlocksInfamyAbility(hero("nurgle"), "boost")).toBe("");
  });
  it("Тзинч не может Усиление, но может Переброс", () => {
    expect(patronBlocksInfamyAbility(hero("tzeentch"), "boost")).toContain("Безумная Гордыня");
    expect(patronBlocksInfamyAbility(hero("tzeentch"), "reroll")).toBe("");
  });
  it("Кхорн, Слаанеш и Неделимый Переброс и Усиление не теряют", () => {
    for (const g of ["khorne", "slaanesh", "undivided", ""]) {
      expect(patronBlocksInfamyAbility(hero(g), "reroll")).toBe("");
      expect(patronBlocksInfamyAbility(hero(g), "boost")).toBe("");
    }
  });
  it("не Хаосит — запрета нет (Очки Судьбы, а не Бесчестья)", () => {
    expect(patronBlocksInfamyAbility(hero("nurgle", "loyalist"), "reroll")).toBe("");
    expect(patronBlocksInfamyAbility(null, "reroll")).toBe("");
  });
});
