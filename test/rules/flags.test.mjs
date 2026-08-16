import { describe, it, expect, afterEach } from "vitest";
import { hasRuleFlag, ruleFlags } from "../../module/rules/flags.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const actor = (over = {}) => ({
  system: { race: "astartes", size: 1, characteristics: {}, ...over },
  items: []
});

describe("флаги-возможности", () => {
  it("Астартес лечится по своей физиологии и бьёт по усиленному профилю", () => {
    const a = actor();
    expect(hasRuleFlag(a, "healing.astartes")).toBe(true);
    expect(hasRuleFlag(a, "unarmed.astartesProfile")).toBe(true);
    expect(hasRuleFlag(a, "talents.geneSeed")).toBe(true);
  });

  it("у человека тех же возможностей нет", () => {
    const a = actor({ race: "human", size: 0 });
    expect(hasRuleFlag(a, "healing.astartes")).toBe(false);
    expect(hasRuleFlag(a, "unarmed.astartesProfile")).toBe(false);
    expect(hasRuleFlag(a, "talents.geneSeed")).toBe(false);
  });

  it("неизвестное имя возможности — false, а не ошибка", () => {
    expect(hasRuleFlag(actor(), "нет.такой.возможности")).toBe(false);
    expect(hasRuleFlag(null, "healing.astartes")).toBe(false);
  });

  it("ruleFlags отдаёт все возможности актора", () => {
    expect([...ruleFlags(actor())].sort()).toEqual(
      ["healing.astartes", "talents.geneSeed", "unarmed.astartesProfile", "weapons.legion"]);
  });

  describe("правило под условием", () => {
    const saved = getRuleSources();

    afterEach(() => {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    });

    // Возможность нельзя получить в обход отбора: не прошедшее `when` правило
    // флага не даёт. Иначе флаг стал бы просто вторым именем расы.
    it("не прошедшее отбор правило возможности не даёт", () => {
      clearRuleSources();
      registerRuleSource("test", () => [{
        id: "test.gated",
        when: { hasTrait: "Gene-Seed" },
        effects: [{ kind: "grantFlag", target: "test.flag" }]
      }]);

      expect(hasRuleFlag(actor(), "test.flag")).toBe(false);
      expect(hasRuleFlag({
        system: { race: "astartes" },
        items: [{ type: "trait", name: "Gene-Seed / Геносемя" }]
      }, "test.flag")).toBe(true);
    });
  });
});
