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

    // Восемь условий этапа 1 плюс два про фракции (hasFaction/targetHasFaction),
    // targetLacksCondition (снятие штрафа «Проворный» у Оглушённых), hasSize/
    // targetHasSize (гейт Размера), targetKeepsNimbleInArmour (Чёрный Панцирь),
    // woundTier (Уровень Ранения, rules/wound-tier.mjs), avatarOfSlaughterOffTarget
    // (метка Аватара Резни, wdbc-sk8s), geneSeedLegion/psyRatingMin (папки
    // пикера Талантов, wdbc-sauo), inRage (гейт Ярости entry.when, wdbc-wyr3)
    // hexMarkedPreyAllyBonus (метка Проклятой Метки, wdbc-xxb7),
    // wearsSealedArmour (гейт «Герметичная броня» entry.when, wdbc-1rno) и
    // hasCondition/targetHasCondition (Состояния актора/цели, wdbc-r5o7).
    expect(Object.keys(predicates.PREDICATES)).toHaveLength(23);
    expect(effects.isKnownEffectKind("rollBonus")).toBe(true);
    expect(effects.isKnownEffectKind("rolBonus")).toBe(false);
    expect(typeof sources.registerRuleSource).toBe("function");
    expect(typeof collect.collectRules).toBe("function");
    expect(typeof matchContext.matchesContext).toBe("function");
    expect(Array.isArray(astartes.ASTARTES_RULES)).toBe(true);
    expect(Array.isArray(core.CORE_RULES)).toBe(true);
    expect(Array.isArray(aeldari.EXODITE_RULES)).toBe(true);
  });
});
