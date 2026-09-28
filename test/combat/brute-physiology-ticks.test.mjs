// test/combat/brute-physiology-ticks.test.mjs
//
// «Физиология Громилы» (Огрин, корбук, глава I): «Огрин не может умереть от
// Кровотечения и иммунен к Обескровливанию. В конце своего Хода Огрин
// автоматически снимает с себя Оглушение». Конец Хода —
// combat/condition-ticks.mjs::processConditionTurnEnd; возможности выдаёт
// запись Конструктора на Черте, иммунитет — запись «Состояние: иммунитет».

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { processConditionTurnEnd } from "../../module/combat/condition-ticks.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

/** Черта с записью «иммунитет к Обескровливанию» — как в паке. */
const immuneTrait = {
  type: "trait", name: "Brute Physiology / Физиология Громилы", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "condition", condKey: "haemorrhaging", condMode: "immunity", when: { negate: false, conditions: [] } }
  ] }] } }
};

function makeActor(conditions = {}, items = []) {
  const updates = [];
  const flags = {};
  const actor = {
    name: "Огрин", items, updates,
    system: {
      characteristics: { t: { bonus: 10, total: 45 }, wp: { bonus: 2 } },
      fatigue: { value: 0 },
      wounds: { value: 30, max: 40, critical: 0 },
      conditions
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
        const parts = path.split(".");
        let target = actor;
        for (const part of parts.slice(0, -1)) target = (target[part] ??= {});
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return actor;
}

const saved = getRuleSources();
const grant = (...flags) => {
  clearRuleSources();
  registerRuleSource("test", () => flags.map(f => ({ id: `test.${f}`, when: {}, effects: [{ kind: "grantFlag", target: f }] })));
};

beforeEach(() => resetCaptured());
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

describe("Физиология Громилы: Кровотечение не убивает", () => {
  it("бросок ≤ 0 — Огрин жив, в карточке причина", async () => {
    grant("brutePhysiology.bleedingNoDeath");
    // Уровень мог остаться с тех пор, как Черты ещё не было: 1 − 2 = −1.
    const actor = makeActor({ bleeding: true, haemorrhagingLevel: 2 });
    captured.dice = [1];
    await processConditionTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "deceased")).toBeUndefined();
    expect(captured.chat[0].content).toContain("Физиология Громилы");
  });

  it("без возможности тот же бросок убивает (страж — тест не зелен от пустоты)", async () => {
    clearRuleSources();
    const actor = makeActor({ bleeding: true, haemorrhagingLevel: 1 });
    captured.dice = [1];
    await processConditionTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "deceased")).toBe(true);
  });
});

describe("Физиология Громилы: иммунитет к Обескровливанию", () => {
  it("бросок 1-5 не добавляет уровня, карточка не врёт «+1 Обескровливание»", async () => {
    clearRuleSources();
    const actor = makeActor({ bleeding: true, haemorrhagingLevel: 0 }, [immuneTrait]);
    captured.dice = [3];
    await processConditionTurnEnd(actor);
    expect(actor.system.conditions.haemorrhagingLevel).toBe(0);
    expect(captured.chat[0].content).not.toContain("+1 Обескровливание");
    expect(captured.chat[0].content).toContain("иммунитет");
  });
});

describe("Физиология Громилы: Оглушение снимается в конце Хода", () => {
  it("снимает Оглушение целиком", async () => {
    grant("brutePhysiology.shakeOffStun");
    const actor = makeActor({ stunned: true, stunnedRounds: 4 });
    await processConditionTurnEnd(actor);
    expect(actor.system.conditions.stunned).toBe(false);
    expect(actor.system.conditions.stunnedRounds).toBe(0);
    expect(captured.chat[0].content).toContain("Физиология Громилы");
  });

  it("книга не делает исключения для Галлюцинаций — снимает и такое", async () => {
    grant("brutePhysiology.shakeOffStun");
    const actor = makeActor({ stunned: true, stunnedRounds: 2, hallucinogenic: true });
    await processConditionTurnEnd(actor);
    expect(actor.system.conditions.stunned).toBe(false);
  });

  it("без возможности Оглушение остаётся", async () => {
    clearRuleSources();
    const actor = makeActor({ stunned: true, stunnedRounds: 2 });
    await processConditionTurnEnd(actor);
    expect(actor.system.conditions.stunned).toBe(true);
  });
});
