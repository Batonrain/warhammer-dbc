// test/rules/roll-mods-rule-id.test.mjs
//
// wdbc-1rno.35 (Наследие Излишеств): ruleRollModsHtml теперь проставляет
// data-rule-id на каждой галочке — единственный способ узнать ПОСЛЕ броска,
// какое именно правило игрок отметил (обычно неважно: все галочки просто
// складываются в число до броска).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { ruleRollModsHtml } from "../../module/rules/roll-mods.mjs";

describe("ruleRollModsHtml: data-rule-id на каждой галочке", () => {
  it("прокидывает ruleId из mods в разметку", () => {
    const resolved = { mods: [{ ruleId: "hatred.meleeBonus", label: "Ненависть", value: 10 }] };
    const { html } = ruleRollModsHtml({ items: [] }, {}, resolved);
    expect(html).toContain('data-rule-id="hatred.meleeBonus"');
  });

  it("несколько галочек — у каждой свой ruleId", () => {
    const resolved = {
      mods: [
        { ruleId: "legacyExcess.charBonus", label: "Излишеств", value: 10 },
        { ruleId: "hatred.meleeBonus", label: "Ненависть", value: 10 }
      ]
    };
    const { html } = ruleRollModsHtml({ items: [] }, {}, resolved);
    expect(html).toContain('data-rule-id="legacyExcess.charBonus"');
    expect(html).toContain('data-rule-id="hatred.meleeBonus"');
  });
});
