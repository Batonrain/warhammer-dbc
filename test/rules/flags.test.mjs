import { describe, it, expect, afterEach } from "vitest";
import { hasRuleFlag, ruleFlags, ruleFlagCost } from "../../module/rules/flags.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const actor = (over = {}) => ({
  system: { race: "astartes", size: 1, characteristics: {}, ...over },
  items: []
});

describe("флаги-возможности", () => {
  it("Астартес лечится по своей физиологии", () => {
    const a = actor();
    expect(hasRuleFlag(a, "healing.astartes")).toBe(true);
    expect(hasRuleFlag(a, "talents.geneSeed")).toBe(true);
  });

  it("у человека тех же возможностей нет", () => {
    const a = actor({ race: "human", size: 0 });
    expect(hasRuleFlag(a, "healing.astartes")).toBe(false);
    expect(hasRuleFlag(a, "talents.geneSeed")).toBe(false);
  });

  it("неизвестное имя возможности — false, а не ошибка", () => {
    expect(hasRuleFlag(actor(), "нет.такой.возможности")).toBe(false);
    expect(hasRuleFlag(null, "healing.astartes")).toBe(false);
  });

  it("ruleFlags отдаёт все возможности актора", () => {
    expect([...ruleFlags(actor())].sort()).toEqual(
      ["healing.astartes", "talents.geneSeed", "weapons.legion"]);
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

  // wdbc-1dc8: цена в пуле (Очки Бесчестия/Судьбы/Боли) едет вместе с
  // grantFlag-эффектом — ruleFlagCost читает её у того же правила, что дало
  // саму возможность (module/rules/item-rules.mjs, kind:"capability").
  describe("ruleFlagCost", () => {
    const saved = getRuleSources();

    afterEach(() => {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    });

    it("возвращает cost правила, давшего эту возможность", () => {
      clearRuleSources();
      registerRuleSource("test", () => [{
        id: "test.priced",
        when: {},
        effects: [{ kind: "grantFlag", target: "test.flag", cost: { pool: "infamy", amount: 2 } }]
      }]);
      expect(ruleFlagCost(actor(), "test.flag")).toEqual({ pool: "infamy", amount: 2 });
    });

    it("возможность без цены — null, а не {}/undefined", () => {
      clearRuleSources();
      registerRuleSource("test", () => [{
        id: "test.free",
        when: {},
        effects: [{ kind: "grantFlag", target: "test.flag" }]
      }]);
      expect(ruleFlagCost(actor(), "test.flag")).toBeNull();
    });

    it("возможности, которой у актора нет вовсе — null", () => {
      expect(ruleFlagCost(actor(), "нет.такой.возможности")).toBeNull();
    });
  });
});
