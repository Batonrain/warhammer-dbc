// test/rules/ask-only-mods.test.mjs
//
// askOnly — модификатор только для галочки в диалоге. В бросках без диалога
// (collectTestMods: кнопки в чате, Реакции) его не складывают: условие видно
// только за столом. Первый такой — «😨 Шок: нет пути к побегу −20» (решение
// Сергея 25.09.2026: без диалога считать, что путь к побегу есть).

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { collectTestMods } from "../../module/rules/roll-mods.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { clearRuleSources, registerRuleSource } from "../../module/rules/sources.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";

const actor = { items: [], system: { characteristics: {} }, getFlag: () => undefined };

afterEach(() => clearRuleSources());

describe("askOnly", () => {
  it("в диалоге галочка есть, без диалога не складывается; обычная галочка складывается", () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "t.ask", label: "Только спросить", when: {}, effects: [{ kind: "rollBonus", target: "all", value: -20, askOnly: true }] },
      { id: "t.box", label: "Обычная галочка", when: {}, effects: [{ kind: "rollBonus", target: "all", value: -10 }] }
    ]);
    const ctx = { kind: "skill", char: "fel", skill: "charm" };
    expect(resolveTest({ actor, ...ctx }).mods.map(m => m.ruleId).sort()).toEqual(["t.ask", "t.box"]);
    expect(collectTestMods(actor, ctx).total).toBe(-10);
  });

  it("«нет пути к побегу» помечена askOnly", () => {
    const a = { ...actor, system: { conditions: { shocked: true } },
      getFlag: (s, k) => (k === "shock" ? { fleeing: true } : undefined) };
    const rule = situationalRules(a, { char: "fel" }).find(r => r.id === "situational.shockNoEscape");
    expect(rule?.effects[0].askOnly).toBe(true);
  });
});
