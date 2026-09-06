// test/rules/advance-category.test.mjs
//
// Значок Д/Н/В на вкладке «Развитие» и ЦЕНА в той же строке считались двумя
// разными путями, и пути расходились (wdbc-gafj, замерено 07.09.2026):
//
//   значок  — resolveCharCat/resolveSkillCat: только совпадение Склонностей;
//   цена    — charImpCost/skillCumCost: сперва расовый override
//             (Африэль/Эльданар/Серый Человек, wdbc-zk69), потом культура
//             легиона, и только потом Склонности.
//
// У персонажа с override «Стойкость всегда Дружественная» значок показывал В
// (Враждебная), а первая ступень стоила 100 опыта — цену Дружественной. Игрок
// видел букву, которая противоречит числу рядом с ней.
//
// Здесь проверяется единая точка расчёта (module/rules/advance-category.mjs):
// значок и цена обязаны звать её же, и порядок приоритетов должен быть тем
// самым, по которому книга считает цену.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { charAdvanceCat, skillAdvanceCat, advanceCatSource } from "../../module/rules/advance-category.mjs";
import { charImpCost, skillCumCost } from "../../module/sheets/tabs/advance.mjs";
import { charAptitudeSet } from "../../module/constants/advancement.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const actor = (system = {}) => ({ system: { aptitudes: [], skills: {}, characteristics: {}, ...system }, items: [] });

const withRule = (effects, label = "Субраса: Эльданар") => {
  clearRuleSources();
  registerRuleSource("test", () => [{ id: "test.rule", label, when: {}, effects }]);
};

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

describe("единая категория Продвижения (значок = цена)", () => {
  it("расовый override делает Характеристику Дружественной — и для значка, и для цены", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "characteristic", match: "t", align: "ally" }]);
    const a = actor();
    const apts = charAptitudeSet(a.system.aptitudes);

    expect(charAdvanceCat(a, "t", apts)).toBe("ally");
    // Совпадений Склонностей нет вовсе — без override была бы Враждебная (500).
    expect(charImpCost(a, "t", "simple", "none")).toBe(100);
  });

  it("расовый override делает Навык Дружественным — и для значка, и для цены", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "skill", match: "Уклонение", align: "ally" }]);
    const a = actor();
    const apts = charAptitudeSet(a.system.aptitudes);
    const def  = SKILLS_DEF.dodge;

    expect(skillAdvanceCat(a, def, { skillKey: "dodge" }, apts)).toBe("ally");
    expect(skillCumCost(a, def, "knows", null, "untrained", null, "", "dodge")).toBe(100);
  });

  it("без override значок остаётся прежним — Враждебная при нуле совпадений", () => {
    clearRuleSources();
    const a = actor();
    const apts = charAptitudeSet(a.system.aptitudes);

    expect(charAdvanceCat(a, "t", apts)).toBe("enemy");
    expect(skillAdvanceCat(a, SKILLS_DEF.dodge, { skillKey: "dodge" }, apts)).toBe("enemy");
  });

  it("Склонности персонажа считаются как раньше: два совпадения — Дружественная", () => {
    clearRuleSources();
    const a = actor({ aptitudes: ["ag", "defence"] });
    const apts = charAptitudeSet(a.system.aptitudes);

    expect(skillAdvanceCat(a, SKILLS_DEF.dodge, { skillKey: "dodge" }, apts)).toBe("ally");
  });

  it("Ремесло и Общие знания Дружественные всегда — приоритет выше override", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "skill", match: "Ремесло", align: "enemy" }]);
    const a = actor();
    const apts = charAptitudeSet(a.system.aptitudes);
    const def  = GROUP_SKILLS_DEF.trade;

    expect(def.alwaysAlly).toBe(true);
    expect(skillAdvanceCat(a, def, { group: "trade", specialty: "Оружейник" }, apts)).toBe("ally");
  });

  it("Враждебный override побеждает Дружественный (правило самого resolveAptitudeOverride)", () => {
    withRule([
      { kind: "grantAptitudeOverride", scope: "characteristic", match: "t", align: "ally" },
      { kind: "grantAptitudeOverride", scope: "characteristic", match: "t", align: "enemy" }
    ]);
    const a = actor();
    expect(charAdvanceCat(a, "t", charAptitudeSet(a.system.aptitudes))).toBe("enemy");
  });
});

describe("подпись источника категории (wdbc-gafj)", () => {
  it("называет правило, давшее override, — игрок видит, откуда Дружественность", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "skill", match: "Уклонение", align: "ally" }],
             "Субраса: Эльданар");
    const a = actor();

    const src = advanceCatSource(a, "skill", "dodge");
    expect(src.kind).toBe("override");
    expect(src.align).toBe("ally");
    expect(src.labels).toContain("Субраса: Эльданар");
    expect(src.text).toMatch(/Дружественн/);
    expect(src.text).toContain("Субраса: Эльданар");
  });

  it("то же для Характеристики", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "characteristic", match: "t", align: "enemy" }],
             "Раса: Серый Человек");
    const a = actor();

    const src = advanceCatSource(a, "char", "t");
    expect(src.kind).toBe("override");
    expect(src.labels).toEqual(["Раса: Серый Человек"]);
    expect(src.text).toMatch(/Враждебн/);
  });

  it("нет ни override, ни культуры — подписи нет (категория из Склонностей, она и так видна)", () => {
    clearRuleSources();
    const a = actor({ aptitudes: ["ag", "defence"] });

    expect(advanceCatSource(a, "skill", "dodge")).toBeNull();
    expect(advanceCatSource(a, "char", "t")).toBeNull();
  });
});
