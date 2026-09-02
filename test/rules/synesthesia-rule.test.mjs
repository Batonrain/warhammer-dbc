// test/rules/synesthesia-rule.test.mjs
//
// Synesthesia/Синэстезия (wdbc-1rno) через общий реестр правил:
// rules/predicates.mjs::targetHasTrait (теперь живой за пределами атак,
// см. skill-roll.test.mjs) + rules/library/synesthesia.mjs, зарегистрировано
// источником "synesthesia" в rules/sources.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

const target = (...names) => ({
  items: names.map(name => ({ type: "mutation", name }))
});

describe("Synesthesia: −20 Scrutiny против цели через resolveTest", () => {
  it("цель с Синэстезией — тест Scrutiny получает −20", () => {
    const actor = { items: [], system: {} };
    const targetActor = target("Synesthesia / Синэстезия");
    const { mods } = resolveTest({ actor, kind: "skill", skill: "scrutiny", targetActor });
    expect(mods).toEqual([{ ruleId: "synesthesia.scrutinyPenalty", label: "Синэстезия: тест Scrutiny против цели", value: -20, halvePenalty: false }]);
  });

  it("цель без Синэстезии — штрафа нет", () => {
    const actor = { items: [], system: {} };
    const targetActor = target("Dodge");
    const { mods } = resolveTest({ actor, kind: "skill", skill: "scrutiny", targetActor });
    expect(mods).toEqual([]);
  });

  it("нет цели вовсе — штрафа нет, не падает", () => {
    const actor = { items: [], system: {} };
    const { mods } = resolveTest({ actor, kind: "skill", skill: "scrutiny" });
    expect(mods).toEqual([]);
  });

  it("другой Навык (не Scrutiny) против той же цели — штраф не участвует", () => {
    const actor = { items: [], system: {} };
    const targetActor = target("Synesthesia / Синэстезия");
    const { mods } = resolveTest({ actor, kind: "skill", skill: "athletics", targetActor });
    expect(mods).toEqual([]);
  });
});
