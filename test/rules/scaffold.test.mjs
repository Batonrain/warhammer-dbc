import { describe, it, expect } from "vitest";

/** Шаг 1.1: файлы каркаса импортируются друг из друга без ошибок. */
describe("каркас module/rules", () => {
  it("все файлы загружаются", async () => {
    const [predicates, effects, sources, collect, matchContext, core, astartes, aeldari] =
      await Promise.all([
        import("../../module/rules/predicates.mjs"),
        import("../../module/rules/effects.mjs"),
        import("../../module/rules/sources.mjs"),
        import("../../module/rules/collect.mjs"),
        import("../../module/rules/match-context.mjs"),
        import("../../module/rules/library/core.mjs"),
        import("../../module/rules/library/astartes.mjs"),
        import("../../module/rules/library/aeldari.mjs")
      ]);

    expect(Object.keys(predicates.PREDICATES)).toHaveLength(8);
    expect(effects.isKnownEffectKind("rollBonus")).toBe(true);
    expect(effects.isKnownEffectKind("rolBonus")).toBe(false);
    expect(typeof sources.registerRuleSource).toBe("function");
    expect(typeof collect.collectRules).toBe("function");
    expect(typeof matchContext.matchesContext).toBe("function");
    // Библиотека Астартес наполнена на этапе 3, остальные книги ждут своей
    // очереди — проверяется только форма.
    expect([core.CORE_RULES, aeldari.AELDARI_RULES]).toEqual([[], []]);
    expect(Array.isArray(astartes.ASTARTES_RULES)).toBe(true);
  });
});
