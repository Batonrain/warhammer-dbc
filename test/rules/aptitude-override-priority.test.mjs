// Приоритет: расовый/субрасовый override (wdbc-zk69) ПЕРЕД культурой легиона
// во всех местах, где раньше решала только cultureCat() — module/sheets/tabs/
// advance.mjs (Развитие), module/sheets/item-picker.mjs (пикер Талантов),
// module/apps/duplicate-refund.mjs (возврат опыта за дубль). Проверяется на
// реальной культуре легиона (не заглушке), чтобы доказать именно ПРИОРИТЕТ,
// а не только то, что resolveAptitudeOverride сам по себе работает (см.
// test/rules/aptitude-overrides.test.mjs — там уже покрыт).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { charImpCost, skillCumCost } from "../../module/sheets/tabs/advance.mjs";
import { talentCategory } from "../../module/sheets/item-picker.mjs";
import { skillStepsCost, talentCost } from "../../module/apps/duplicate-refund.mjs";
import { CHAR_COST, SKILL_COST, TALENT_COST } from "../../module/constants/advancement.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

// Легион I (Тёмные Ангелы): культура делает "Charm" враждебным (CULT.I.hS).
// Легион IV (Железные Воины): культура делает "Double Team" враждебным (CULT.IV.hT).
// Оба взяты БЕЗ выбора Ордена/Банды (chapter не задан) — top-level cult легиона.
const actorWithLegion = (legion, over = {}) => ({
  system: { aptitudes: [], characteristics: {}, geneSeed: { legion }, patronGod: "", race: "astartes", ...over },
  items: []
});

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

const overrideRule = (scope, match, align = "ally") => {
  registerRuleSource("test-override", () => [{
    id: "test.override", when: {},
    effects: [{ kind: "grantAptitudeOverride", scope, match, align }]
  }]);
};

describe("приоритет override над cultureCat легиона", () => {
  it("charImpCost (advance.mjs): характеристика без override дорога по культуре враждебной семьи, с override — дёшево", () => {
    // WS у Легиона I никак не упомянут в CULT.I — контроль: цена по обычным
    // Склонностям (0 совпадений apts=[] → enemy), безо всякого override.
    expect(charImpCost(actorWithLegion("I"), "ws", "simple")).toBe(CHAR_COST.enemy[0]);
    overrideRule("characteristic", "ws", "ally");
    expect(charImpCost(actorWithLegion("I"), "ws", "simple")).toBe(CHAR_COST.ally[0]);
  });

  it("skillCumCost (advance.mjs): override перебивает враждебную культуру легиона I на Charm", () => {
    // def передаётся параметром (не ищется внутри) — англ. label напрямую
    // сравнимо с CULT.I.hS=["Charm"], без вопроса языка компендиумных данных.
    const def = { label: "Charm", char: "fel" };
    const cost = (a) => skillCumCost(a, def, "knows");
    expect(cost(actorWithLegion("I"))).toBe(SKILL_COST.enemy[0]);
    overrideRule("skill", "Charm", "ally");
    expect(cost(actorWithLegion("I"))).toBe(SKILL_COST.ally[0]);
  });

  it("talentCategory (item-picker.mjs): override перебивает враждебную культуру легиона IV", () => {
    expect(talentCategory(actorWithLegion("IV"), "Double Team")).toBe("enemy");
    overrideRule("talent", "Double Team", "ally");
    expect(talentCategory(actorWithLegion("IV"), "Double Team")).toBe("ally");
  });

  it("duplicate-refund.skillStepsCost: override перебивает враждебную культуру легиона I на Charm", () => {
    // skillKey ищется внутри (SKILLS_DEF.charm.en — "Charm", wdbc-ko14) — с
    // фикса cultureCat легиона за англ. «Charm» цепляется штатно (CULT.I.hS),
    // enemy здесь идёт от культуры, не от обычных Склонностей (apts=[]
    // тоже дал бы enemy — до фикса это совпадение маскировало баг).
    const cost = (a) => skillStepsCost(a, "charm", [0]);
    expect(cost(actorWithLegion("I"))).toBe(SKILL_COST.enemy[0]);
    overrideRule("skill", "Обаяние", "ally");
    expect(cost(actorWithLegion("I"))).toBe(SKILL_COST.ally[0]);
  });

  it("wdbc-ko14: cultureCat теперь реально матчит Навыки легиона — Scrutiny у Легиона I дружественнен по культуре, не по Склонностям", () => {
    // Контроль бага: до фикса SKILLS_DEF.scrutiny.label = "Проницательность"
    // (кириллица) никогда не совпадал с CULT.I.fS=["Scrutiny"], и пустые
    // Склонности (apts=[]) давали enemy вместо книжного ally.
    const def = { label: "Проницательность", en: "Scrutiny", char: "per" };
    expect(skillCumCost(actorWithLegion("I"), def, "knows")).toBe(SKILL_COST.ally[0]);
  });

  it("duplicate-refund.talentCost: та же приоритетная цепочка на возврате опыта", () => {
    const talent = { name: "Double Team", system: { tier: 1, aptitudes: [] } };
    expect(talentCost(actorWithLegion("IV"), talent)).toBe(TALENT_COST.enemy[0]);
    overrideRule("talent", "Double Team", "ally");
    expect(talentCost(actorWithLegion("IV"), talent)).toBe(TALENT_COST.ally[0]);
  });
});
