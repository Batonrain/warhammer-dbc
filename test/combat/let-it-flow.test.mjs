// test/combat/let-it-flow.test.mjs
//
// Талант Геносемени «Let It Flow / Пусть Льётся» (корбук, гл. 3): «Когда он
// умирает от Кровотечения, вместо этого персонаж только получает 1 Усталости».
// Точка — combat/condition-death.mjs::killByCondition (причина "bleeding");
// возможность geneseed.core.letItFlow выдаёт запись Конструктора на Таланте.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { killByCondition, letItFlowSaves } from "../../module/combat/condition-death.mjs";
import { processConditionTurnEnd } from "../../module/combat/condition-ticks.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const KEY = "geneseed.core.letItFlow";

function makeActor(conditions = {}) {
  const flags = {};
  const actor = {
    id: "a1", name: "Десантник", items: [], statuses: [],
    system: {
      characteristics: { t: { bonus: 6, total: 60 }, wp: { bonus: 4 } },
      fatigue: { value: 0 },
      wounds: { value: 30, max: 40, critical: 0 },
      conditions
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    toggleStatusEffect: async () => {},
    update: async data => {
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

beforeEach(() => { resetCaptured(); clearRuleSources(); });
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

describe("Пусть Льётся: смерть от Кровотечения → 1 Усталости", () => {
  it("killByCondition(bleeding) с Талантом: актор жив, Усталость +1, возвращает false", async () => {
    grant(KEY);
    const a = makeActor();
    expect(await killByCondition(a, "bleeding")).toBe(false);
    expect(a.getFlag("warhammer-dbc", "deceased")).toBeFalsy();
    expect(a.system.fatigue.value).toBe(1);
  });

  it("без Таланта то же Кровотечение убивает (страж — тест не зелен от пустоты)", async () => {
    const a = makeActor();
    expect(await killByCondition(a, "bleeding")).toBe(true);
    expect(a.getFlag("warhammer-dbc", "deceased")).toBe(true);
    expect(a.system.fatigue.value).toBe(0);
  });

  it("Талант спасает только от Кровотечения — Удушье и Гангрена убивают по-прежнему", async () => {
    grant(KEY);
    for (const cause of ["suffocating", "gangrene", null]) {
      const a = makeActor();
      expect(await killByCondition(a, cause)).toBe(true);
      expect(a.system.fatigue.value).toBe(0);
    }
  });

  it("уже мёртвого и защищённого Божественной Защитой Усталостью не наказывает", async () => {
    grant(KEY);
    const dead = makeActor();
    dead.setFlag("warhammer-dbc", "deceased", true);
    expect(await killByCondition(dead, "bleeding")).toBe(false);
    expect(dead.system.fatigue.value).toBe(0);

    const prot = makeActor();
    await prot.setFlag("warhammer-dbc", "divineProtection", true);
    await killByCondition(prot, "bleeding");
    expect(prot.system.fatigue.value).toBe(0);
  });

  it("конец Хода: бросок ≤ 0 — карточка называет Талант, а не «СМЕРТЬ»; Усталость +1", async () => {
    grant(KEY);
    const a = makeActor({ bleeding: true, haemorrhagingLevel: 1 });
    captured.dice = [1]; // 1 − 1 = 0 → смерть
    await processConditionTurnEnd(a);
    expect(a.getFlag("warhammer-dbc", "deceased")).toBeFalsy();
    expect(a.system.fatigue.value).toBe(1);
    const html = captured.chat.map(c => c.content).join("\n");
    expect(html).toContain("Пусть Льётся");
    expect(html).not.toContain("СМЕРТЬ");
  });

  it("конец Хода без Таланта: та же карточка — СМЕРТЬ и флаг смерти", async () => {
    const a = makeActor({ bleeding: true, haemorrhagingLevel: 1 });
    captured.dice = [1];
    await processConditionTurnEnd(a);
    expect(a.getFlag("warhammer-dbc", "deceased")).toBe(true);
    expect(captured.chat.map(c => c.content).join("\n")).toContain("СМЕРТЬ");
  });

  it("letItFlowSaves: только причина bleeding и только при возможности", () => {
    grant(KEY);
    const a = makeActor();
    expect(letItFlowSaves(a, "bleeding")).toBe(true);
    expect(letItFlowSaves(a, "gangrene")).toBe(false);
    clearRuleSources();
    expect(letItFlowSaves(a, "bleeding")).toBe(false);
  });
});

describe("данные", () => {
  it("возможность заведена и ссылается на читателя в condition-death", () => {
    expect(CAPABILITIES[KEY].reader).toContain("condition-death.mjs");
  });
});
