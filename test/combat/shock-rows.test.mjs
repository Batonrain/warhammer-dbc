// test/combat/shock-rows.test.mjs
//
// Шок (стр. 53): строка таблицы применяется сама — штраф к тестам, запрет
// действовать, «в первый Ход оправиться нельзя», сроки Без сознания/
// Беспомощности, штраф до конца сцены. Раньше строка была только текстом в
// чате, а «В Шоке» — голым флагом без последствий.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { SHOCK_TABLE } from "../../module/constants/fear-tables.mjs";
import { shockPenalty, shockFlagPatch, shockApLocked } from "../../module/rules/shock.mjs";
import { applyShockRow, revertShock, postShockRecoveryPrompt, _executeFearRoll, rollShockRecovery,
         revertFearFailure, fearCardActor }
  from "../../module/combat/fear.mjs";
import { actionBlockReason } from "../../module/combat/action-economy.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const row = min => SHOCK_TABLE.find(r => r.min === min);

/** Актор с настоящей записью по путям, «-=» для флагов и эффектами. */
function makeActor({ shocked = false, flags = {}, conditions = {}, chars = {} } = {}) {
  const a = {
    id: "a1", uuid: "Actor.a1", name: "Подставной", type: "character", items: [], effects: [],
    system: {
      characteristics: { wp: { total: 40 }, int: { total: 30 }, t: { total: 35 }, ...chars },
      fatigue: { value: 0 }, fate: { value: 0 },
      conditions: { shocked, ...conditions }
    },
    flags: { "warhammer-dbc": structuredClone(flags) },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, v) { (this.flags[scope] ??= {})[key] = v; },
    async unsetFlag(scope, key) { delete this.flags[scope]?.[key]; },
    async update(data) {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        const last = parts.pop();
        let node = this;
        for (const k of parts) node = (node[k] ??= {});
        if (last.startsWith("-=")) delete node[last.slice(2)];
        else node[last] = v;
      }
    },
    async createEmbeddedDocuments(type, docs) {
      const made = docs.map(d => ({ ...d, getFlag: (s, k) => d.flags?.[s]?.[k],
        delete: async () => { a.effects = a.effects.filter(e => e !== made[0]); } }));
      a.effects.push(...made);
      return made;
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("shockPenalty: штраф выпавшей строки", () => {
  it("«дрожит» (21–40): −10 ко всему, кроме T", () => {
    const a = makeActor({ shocked: true, flags: { shock: { penalty: -10 } } });
    expect(shockPenalty(a, "wp")).toBe(-10);
    expect(shockPenalty(a, "bs")).toBe(-10);
    expect(shockPenalty(a, "t")).toBe(0);
  });

  it("строка без штрафа после выхода из Шока не действует", () => {
    const a = makeActor({ shocked: false, flags: { shock: { penalty: -10 } } });
    expect(shockPenalty(a, "wp")).toBe(0);
  });

  it("штраф до конца сцены (141–160) — и на T; после выхода остаётся", () => {
    const a = makeActor({ flags: { shockScenePenalty: { value: -20, allTests: true } } });
    expect(shockPenalty(a, "t")).toBe(-20);
    expect(shockPenalty(a, "ag")).toBe(-20);
  });

  it("строка и сцена вместе — берётся более тяжёлый, а не сумма", () => {
    const a = makeActor({ shocked: true, flags: { shock: { penalty: -10 }, shockScenePenalty: { value: -20 } } });
    expect(shockPenalty(a, "wp")).toBe(-20);
  });

  it("штраф доезжает до общего сбора модификаторов", () => {
    const a = makeActor({ shocked: true, flags: { shock: { penalty: -10 } } });
    const rule = situationalRules(a, { char: "wp" }).find(r => r.id === "situational.shock");
    expect(rule.effects[0]).toMatchObject({ value: -10, auto: true });
  });

  it("бегство (81–100): −20 «нет пути к побегу» — галочка, не автоштраф", () => {
    const a = makeActor({ shocked: true, flags: { shock: { fleeing: true } } });
    const rule = situationalRules(a, { char: "wp" }).find(r => r.id === "situational.shockNoEscape");
    expect(rule.effects[0].value).toBe(-20);
    expect(rule.effects[0].auto).toBeFalsy();
    expect(situationalRules(a, { char: "t" }).some(r => r.id === "situational.shockNoEscape")).toBe(false);
  });
});

describe("shockFlagPatch: штраф сцены не ослабляется", () => {
  it("−10 после −20 в той же сцене — остаётся −20", () => {
    const a = makeActor({ flags: { shockScenePenalty: { value: -20, allTests: true } } });
    expect(shockFlagPatch(a, { scenePenalty: -10 })).toEqual({});
  });
});

describe("applyShockRow: строка применяется сама", () => {
  it("21–40: «В Шоке» со штрафом −10", async () => {
    const a = makeActor();
    await applyShockRow(a, row(21));
    expect(a.system.conditions.shocked).toBe(true);
    expect(a.flags["warhammer-dbc"].shock.penalty).toBe(-10);
  });

  it("61–80: замер — действовать нельзя, −10 до конца сцены", async () => {
    const a = makeActor();
    await applyShockRow(a, row(61));
    expect(shockApLocked(a)).toBe(true);
    expect(actionBlockReason(a)).toContain("Шок");
    expect(a.flags["warhammer-dbc"].shockScenePenalty).toEqual({ value: -10, allTests: false });
  });

  it("1–20: не «В Шоке», но в следующий Ход только Полудействие", async () => {
    const a = makeActor();
    await applyShockRow(a, row(1));
    expect(a.system.conditions.shocked).toBeFalsy();
    expect(a.flags["warhammer-dbc"].shockHalfAction).toBe(true);
  });

  it("101–120: Без сознания на 1d5 Раундов со сроком", async () => {
    captured.nextRoll = 3;
    const a = makeActor();
    const { html } = await applyShockRow(a, row(101));
    expect(a.system.conditions.unconscious).toBe(true);
    expect(a.effects[0].duration).toMatchObject({ value: 3, units: "rounds" });
    expect(html).toContain("Без сознания");
  });

  it("171+: кнопка теста T+0, без «В Шоке»", async () => {
    const a = makeActor();
    const { html } = await applyShockRow(a, row(171));
    expect(html).toContain("wh-shock-heart-btn");
    expect(a.system.conditions.shocked).toBeFalsy();
  });

  it("откат (переброс Демона) снимает всё, что наложила строка", async () => {
    captured.nextRoll = 3;
    const a = makeActor();
    const { undo } = await applyShockRow(a, row(101));
    await revertShock(a, undo);
    expect(a.system.conditions.shocked).toBe(false);
    expect(a.system.conditions.unconscious).toBe(false);
    expect(a.effects).toHaveLength(0);
    expect(a.flags["warhammer-dbc"].shock).toBeUndefined();
  });

  it("откат возвращает прежний штраф сцены", async () => {
    const a = makeActor({ flags: { shockScenePenalty: { value: -10, allTests: false } } });
    const { undo } = await applyShockRow(a, row(141));
    expect(a.flags["warhammer-dbc"].shockScenePenalty.value).toBe(-20);
    await revertShock(a, undo);
    expect(a.flags["warhammer-dbc"].shockScenePenalty).toEqual({ value: -10, allTests: false });
  });
});

describe("Выход из Шока: первый Ход и «не реагирует ни на что»", () => {
  it("41–60: первый Ход без кнопки, конец Хода его закрывает, дальше кнопка", async () => {
    const a = makeActor();
    await applyShockRow(a, row(41));
    await postShockRecoveryPrompt(a);                              // начало первого Хода
    expect(captured.chat.at(-1).content).not.toContain("wh-shock-recovery-btn");
    expect(captured.chat.at(-1).content).toContain("Первый Ход Шока");
    await postShockRecoveryPrompt(a, { at: "end", prompt: true }); // его конец
    expect(captured.chat.at(-1).content).not.toContain("wh-shock-recovery-btn");
    await postShockRecoveryPrompt(a);                              // следующий Ход
    expect(captured.chat.at(-1).content).toContain("wh-shock-recovery-btn");
  });

  it("без сознания — ни кнопки, ни теста", async () => {
    const a = makeActor({ shocked: true, conditions: { unconscious: true }, flags: { shock: { penalty: -10 } } });
    const before = captured.chat.length;
    await postShockRecoveryPrompt(a);
    expect(captured.chat.length).toBe(before);
    const res = await rollShockRecovery(a);
    expect(res.blocked).toBeTruthy();
  });

  it("бегство: напоминание говорит «только вдали от источника»", async () => {
    const a = makeActor({ shocked: true, flags: { shock: { fleeing: true } } });
    await postShockRecoveryPrompt(a);
    expect(captured.chat.at(-1).content).toContain("вдали от источника");
  });

  it("штраф −10 строки действует и на сам тест выхода (W, не T)", async () => {
    captured.nextRoll = 35; // 40 − 10 = 30 → провал
    const a = makeActor({ shocked: true, flags: { shock: { penalty: -10 } } });
    const { success, eff } = await rollShockRecovery(a);
    expect(eff).toBe(30);
    expect(success).toBe(false);
  });
});

describe("Страх и Машины (стр. 53): fear.machineMind — Int вместо W", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });
  const grantMachine = () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.machine", when: {}, effects: [{ kind: "grantFlag", target: "fear.machineMind" }] }
    ]);
  };

  it("тест Страха машины — по Int", async () => {
    grantMachine();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 1, "important", 0, 0);
    const msg = captured.chat.find(m => m.content.includes("Тест Страха"));
    expect(msg.content).toContain("<label>Порог</label><b>40</b>"); // Int 30 + важный(+10)
    expect(msg.content).toContain("Int: 30");
  });

  it("выход из Шока машины — по Int", async () => {
    grantMachine();
    captured.nextRoll = 1;
    const { eff } = await rollShockRecovery(makeActor({ shocked: true }));
    expect(eff).toBe(30);
  });

  it("без флага — по W, как обычно", async () => {
    clearRuleSources();
    captured.nextRoll = 1;
    const { eff } = await rollShockRecovery(makeActor({ shocked: true }));
    expect(eff).toBe(40);
  });
});

describe("Кнопки карточки Страха: персонаж и откат провала", () => {
  it("карточка с переброском Демона несёт uuid персонажа и откат Шока", async () => {
    captured.dice = [99, 30];      // провал теста, Шок 30 + 30 = 60 → «пятится»
    const a = makeActor();
    await _executeFearRoll(a, 1, "important", 0, 0, { demon: true });
    const ctx = captured.chat.at(-1).flags["warhammer-dbc"].fearTest;
    expect(ctx.actorUuid).toBe("Actor.a1");
    expect(a.system.conditions.shocked).toBe(true);
    await revertFearFailure(a, ctx.failUndo);
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("персонаж ищется по uuid (несвязанный токен), а не по id актора мира", async () => {
    const token = { id: "a1", name: "Токен" };
    const realFromUuid = globalThis.fromUuid;
    globalThis.fromUuid = async u => u === "Scene.s.Token.t.Actor.a1" ? token : null;
    try {
      expect(await fearCardActor({ actorId: "a1", actorUuid: "Scene.s.Token.t.Actor.a1" })).toBe(token);
    } finally { globalThis.fromUuid = realFromUuid; }
  });
});
