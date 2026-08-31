// test/rules/avatar-of-slaughter-rule.test.mjs
//
// Следствие метки Avatar of Slaughter/Аватар Резни (wdbc-sk8s) через общий
// реестр правил: rules/predicates.mjs::avatarOfSlaughterOffTarget +
// rules/library/avatar-of-slaughter.mjs, зарегистрировано как источник
// "avatarOfSlaughter" в rules/sources.mjs. Сама выдача метки —
// module/combat/avatar-of-slaughter.mjs (см. соответствующий тест).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

function markedActor(berserkerUuid) {
  const flags = { "warhammer-dbc.avatarOfSlaughterMark": { berserkerUuid } };
  return {
    items: [],
    system: {},
    getFlag: (scope, key) => flags[`${scope}.${key}`]
  };
}

describe("avatarOfSlaughterOffTarget через resolveTest", () => {
  it("атакует НЕ Берсерка — получает −20", () => {
    const actor = markedActor("Actor.berserker1");
    const targetActor = { uuid: "Actor.someoneElse" };
    const { mods } = resolveTest({ actor, kind: "attack", targetActor });
    expect(mods).toEqual([{ ruleId: "avatarOfSlaughter.penalty", label: "Аватар Резни: атакует не Берсерка", value: -20, halvePenalty: false }]);
  });

  it("атакует САМОГО Берсерка — штрафа нет", () => {
    const actor = markedActor("Actor.berserker1");
    const targetActor = { uuid: "Actor.berserker1" };
    const { mods } = resolveTest({ actor, kind: "attack", targetActor });
    expect(mods).toEqual([]);
  });

  it("нет метки вовсе — штрафа нет", () => {
    const actor = { items: [], system: {}, getFlag: () => undefined };
    const { mods } = resolveTest({ actor, kind: "attack", targetActor: { uuid: "Actor.anyone" } });
    expect(mods).toEqual([]);
  });

  it("не атака (напр. обычный тест Навыка) — штраф не участвует", () => {
    const actor = markedActor("Actor.berserker1");
    const { mods } = resolveTest({ actor, kind: "skill", skill: "athletics", targetActor: { uuid: "Actor.someoneElse" } });
    expect(mods).toEqual([]);
  });
});
