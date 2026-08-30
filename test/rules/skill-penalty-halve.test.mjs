// test/rules/skill-penalty-halve.test.mjs
//
// wdbc-gzuf (Серый Человек): «Psyniscience — все штрафы, включая необученность,
// вдвое меньше» — новый scope Конструктора МЕХАНИКА, kind:"testMod" +
// modValueMode:"halvePenalty". Два разных потребителя одной записи:
//   1. Штраф необученности — derived-поле skill.total (documents/actor.mjs),
//      считается всегда, без диалога.
//   2. Ситуативный штраф теста — галочка диалога броска (kind:"penaltyMul",
//      resolve-test.mjs::rollModsFromRules через item-rules.mjs), НЕ применяется
//      молча — тот же принцип, что у всех остальных ½-штрафов в системе.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

function halvePenaltyTraitItem({ id = "trait-1", name = "Физиология Отеший", skillKey = "psyniscience" } = {}) {
  return {
    id, name, type: "trait", system: {},
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "migratedEffect") ? true : undefined,
    flags: { "warhammer-dbc": { mechanics: [
      { id: "g1", operator: "AND", entries: [
        { id: "e1", kind: "testMod", modScope: "skill", skillKey, modValueMode: "halvePenalty", label: "½ штрафа" }
      ] }
    ] } },
    effects: []
  };
}

function characterWith({ items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.skills.psyniscience = { rank: "untrained", specialization: "" };
  system.skills.athletics = { rank: "untrained", specialization: "" };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Конструктор МЕХАНИКА: testMod halvePenalty", () => {
  it("без трейта — необученность даёт обычный -20", () => {
    const system = characterWith();
    const per = system.characteristics.per.total ?? 0;
    expect(system.skills.psyniscience.total).toBe(per - 20);
  });

  it("с трейтом — необученность у ЦЕЛЕВОГО навыка ополовинена до -10, у остальных не тронута", () => {
    const system = characterWith({ items: [halvePenaltyTraitItem()] });
    const per = system.characteristics.per.total ?? 0;
    expect(system.skills.psyniscience.total).toBe(per - 10);
    expect(system.skills.athletics.total).toBe((system.characteristics.s.total ?? 0) - 20);
  });

  it("ruleFromEntry: testMod+halvePenalty на предмете рождает kind:penaltyMul, а не rollBonus", () => {
    const rules = rulesFromItemMechanics([halvePenaltyTraitItem()]);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([{ kind: "penaltyMul", target: "skill:psyniscience", factor: 0.5 }]);
  });
});
