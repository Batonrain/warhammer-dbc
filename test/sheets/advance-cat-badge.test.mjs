// test/sheets/advance-cat-badge.test.mjs
//
// Значок Д/Н/В в строке Характеристики/Навыка на вкладке «Развитие» обязан
// показывать ТУ ЖЕ категорию, по которой рядом посчитана цена (wdbc-gafj).
// До правки контекст листа считал его голым resolveCharCat/resolveSkillCat —
// только по совпадению Склонностей, — и у персонажа с расовым override
// «Стойкость всегда Дружественная» буква была В, а первая ступень стоила 100
// опыта, то есть цену Дружественной.
//
// Здесь проверяется именно СОБРАННЫЙ КОНТЕКСТ шаблона, а не общая функция:
// расхождение и жило в том, что лист звал не ту функцию.

import { describe, it, expect, afterEach } from "vitest";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { characterContext } from "../../module/sheets/character-context.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function ctxOf({ items = [], ...system } = {}) {
  const sheet = sheetOf(WarhammerCharacterSheet, {
    items, characteristics: {}, skills: {}, groupSkills: {}, ...system
  });
  sheet.actor.items.contents = sheet.actor.items;
  return characterContext(sheet.actor);
}

function advanceCtxOf({ items = [], ...system } = {}) {
  const sheet = sheetOf(WarhammerCharacterSheet, {
    items, characteristics: {}, skills: {}, groupSkills: {}, ...system
  });
  sheet.actor.items.contents = sheet.actor.items;
  return buildGetData(sheet.actor);
}

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

function withOverride(effects, label) {
  clearRuleSources();
  registerRuleSource("test", () => [{ id: "test.rule", label, when: {}, effects }]);
}

describe("значок Д/Н/В на «Развитии» показывает ту же категорию, что и цена", () => {
  it("расовый override делает Характеристику Дружественной прямо в контексте листа", () => {
    withOverride([{ kind: "grantAptitudeOverride", scope: "characteristic", match: "t", align: "ally" }],
                 "Субраса: Эльданар");
    // Склонностей нет вовсе — без override буква была бы В.
    const t = ctxOf({ aptitudes: [] }).chars.find(c => c.key === "t");

    expect(t.aptCat).toBe("ally");
    expect(t.aptSourceText).toContain("Субраса: Эльданар");
  });

  it("расовый override делает Навык Дружественным прямо в контексте листа", () => {
    withOverride([{ kind: "grantAptitudeOverride", scope: "skill", match: "Уклонение", align: "ally" }],
                 "Раса: Серый Человек");
    const dodge = advanceCtxOf({ aptitudes: [] }).skillsAdvance.find(s => s.key === "dodge");

    expect(dodge.aptCat).toBe("ally");
    expect(dodge.aptSourceText).toContain("Раса: Серый Человек");
  });

  it("без override — прежнее поведение и без подписи источника", () => {
    clearRuleSources();
    const ctx = ctxOf({ aptitudes: ["ws", "offence"] });

    expect(ctx.chars.find(c => c.key === "ws").aptCat).toBe("ally");
    expect(ctx.chars.find(c => c.key === "t").aptCat).toBe("enemy");
    expect(ctx.chars.find(c => c.key === "t").aptSourceText).toBe("");
  });
});
