// test/rules/spellwise-psyniscience.test.mjs
//
// Spellwise / Колдознавец (Дар Тзинча, wdbc-1rno): «может изучать
// Psyniscience, даже если не является псайкером» — реализовано ЧИСТО
// ДАННЫМИ через уже готовый второй режим записи «Возможность»
// (capabilityMode:"aptOverride", wdbc-zk69): Психонаука считается
// Дружественным Навыком независимо от Покровительства/склонностей.

import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { resolveAptitudeOverride } from "../../module/rules/aptitude-overrides.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const DEFAULT_SOURCES = getRuleSources();

function spellwiseDoc() {
  return packDocById("packs-src/mutations/Дары_Богов/Тзинч", "TMx5euWXHzofQ16S");
}

describe("Spellwise — Психонаука всегда Дружественный Навык (aptOverride)", () => {
  it("пак несёт запись aptOverride на скоуп skill/match Психонаука/align ally", () => {
    const entries = spellwiseDoc().flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    const entry = entries.find(e => e.capabilityMode === "aptOverride");
    expect(entry).toBeTruthy();
    expect(entry.capabilityAptScope).toBe("skill");
    expect(entry.capabilityAptMatch).toBe("Психонаука");
    expect(entry.capabilityAptAlign).toBe("ally");
  });

  it("сквозная проверка: rulesFromItemMechanics → resolveAptitudeOverride видит «ally» для Психонауки", () => {
    clearRuleSources();
    try {
      const doc = spellwiseDoc();
      const rules = rulesFromItemMechanics([doc]);
      registerRuleSource("test", () => rules);
      const actor = { system: {}, items: [] };
      expect(resolveAptitudeOverride(actor, "skill", "Психонаука")).toBe("ally");
      // Другой Навык этим override не задет.
      expect(resolveAptitudeOverride(actor, "skill", "Медика")).toBeNull();
    } finally {
      clearRuleSources();
      for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
    }
  });
});
