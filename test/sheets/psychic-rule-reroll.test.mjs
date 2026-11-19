// test/sheets/psychic-rule-reroll.test.mjs
//
// Перебросы области «power» доезжают до психотеста: окно манифестации даёт
// радиокнопку ruleRerollsHtml, выбранная едет в opts.ruleReroll. Дьяболист
// (rerollMode "reverse") обращает бросок, если так лучше.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { executePsychotest } from "../../module/sheets/tabs/psychic.mjs";

const actor = {
  id: "a1", name: "Псайкер", items: [],
  system: {
    characteristics: { wp: { total: 40 }, t: { bonus: 3 } },
    fatigue: { value: 0, max: 0 },
    psyker: { class: "bound", currentRating: 3, rating: 3, sustain: 0 },
    corruption: { value: 0 }, corruptionBonus: 0
  },
  getFlag: () => undefined, update: async () => {}
};
const item = { name: "Тестовая сила", system: { powerType: "utility", discipline: "" }, update: async () => {} };
const opts = { mPR: 2, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
  pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 };

beforeEach(resetCaptured);

describe("психотест: выбранный переброс правила", () => {
  it("обращение 73 → 37 при Пороге 50 даёт успех и строку в карточке", async () => {
    captured.nextRoll = 73;
    await executePsychotest(actor, item, { ...opts, ruleReroll: { mode: "reverse", rolls: 1, label: "Дьяболист" } });
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("обращено 73 → 37");
    expect(msg.content).toContain("<b>37</b>");
  });

  it("без переброса бросок как есть", async () => {
    captured.nextRoll = 73;
    await executePsychotest(actor, item, opts);
    expect(captured.chat.at(-1).content).not.toContain("обращено");
  });
});

describe("Дьяболист: обращение доходит до окна манифестации", () => {
  it("включённый (кнопкой) Талант даёт радиокнопку «обратить цифры» на тесте psychic power", async () => {
    const { packDocById } = await import("../support/pack-doc.mjs");
    const { rulesFromItemMechanics } = await import("../../module/rules/item-rules.mjs");
    const { registerRuleSource, clearRuleSources, getRuleSources } = await import("../../module/rules/sources.mjs");
    const { ruleRerollsHtml } = await import("../../module/rules/roll-mods.mjs");
    const d = packDocById("packs-src/talents/Элитные_архетипы/Ветеран_Долгой_Войны", "DuwBvBfo78y5Wei5"); // Diabolist / Дьяболист
    const saved = getRuleSources();
    const flags = { "warhammer-dbc": { ...d.flags["warhammer-dbc"], activated: { combatId: "", at: 0 } } };
    const talent = { id: d._id, name: d.name, type: d.type, system: d.system, flags };
    clearRuleSources();
    registerRuleSource("test", () => rulesFromItemMechanics([talent]));
    try {
      const { html, rerolls } = ruleRerollsHtml(actor, { kind: "power", power: item, char: "wp" });
      expect(rerolls.map(r => r.mode)).toContain("reverse");
      expect(html).toContain("обратить цифры");
    } finally {
      clearRuleSources();
      for (const [k, f] of saved) registerRuleSource(k, f);
    }
  });
});
