// test/combat/stun-taint.test.mjs
//
// wdbc-777vf: Струп (Основная книга, стр. 283) — «Если персонаж не имеет
// Покровительства Нургла, за каждый Ход Оглушения он получает 1 Порчи».
// Раньше Порча шла только текстом в карточке пост-эффекта.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { stunTaintFor, stunTaintStep, STUN_TAINT_ACTOR_FLAG } from "../../module/rules/stun-taint.mjs";
import { processConditionTurnStart } from "../../module/combat/condition-ticks.mjs";
import { triggerAfterEffect } from "../../module/sheets/tabs/drugs.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const NS = "warhammer-dbc";
const TAINT = { perTurn: 1, exemptPatron: "nurgle", source: "Scab / Струп" };

function realScab() {
  const found = packDocuments("chemistry", "drug").find(({ doc }) => /Scab/.test(doc.name));
  expect(found).toBeTruthy();
  return found.doc;
}

function makeActor({ conditions = {}, patronGod = "", corruption = 10, taint = null } = {}) {
  const updates = [];
  const flags = { [NS]: taint ? { [STUN_TAINT_ACTOR_FLAG]: taint } : {} };
  const actor = {
    name: "Подставной",
    updates,
    items: Object.assign([], { contents: [] }),
    flags,
    system: {
      characteristics: { t: { bonus: 0, total: 40 }, wp: { bonus: 0 } },
      fatigue: { value: 0 },
      wounds: { value: 5, max: 10, critical: 0, firstAidUsed: true },
      corruption: { value: corruption },
      corruptionBonus: 0,
      patronGod,
      conditions
    },
    getFlag: (_scope, key) => actor.flags[NS][key],
    setFlag: async () => {},
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
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

beforeEach(resetCaptured);

describe("stunTaintFor: данные Струпа", () => {
  it("пак: у Струпа правило 1 Порчи за Ход Оглушения, исключение — Покровитель Нургл", () => {
    const doc = realScab();
    expect(doc.flags[NS].afterEffectStunTaint).toEqual({ perTurn: 1, exemptPatron: "nurgle" });
    expect(stunTaintFor(doc, doc.system.afterEffectSpecial))
      .toEqual({ perTurn: 1, exemptPatron: "nurgle", source: doc.name });
  });

  it("препарат без правила или без Оглушения — null", () => {
    expect(stunTaintFor({ name: "X", flags: {} }, { grantsCondition: "stunned" })).toBeNull();
    expect(stunTaintFor({ name: "X", flags: { [NS]: { afterEffectStunTaint: { perTurn: 1 } } } }, { grantsCondition: "" })).toBeNull();
  });
});

describe("stunTaintStep", () => {
  it("Оглушён, не Нургл — начисляет и флаг остаётся", () => {
    expect(stunTaintStep(TAINT, { stunned: true, ending: false, patronGod: "khorne" })).toEqual({ amount: 1, clear: false });
  });
  it("Покровитель Нургл — Порчи нет", () => {
    expect(stunTaintStep(TAINT, { stunned: true, ending: false, patronGod: "nurgle" }).amount).toBe(0);
  });
  it("последний Ход Оглушения — начисляет и снимает флаг", () => {
    expect(stunTaintStep(TAINT, { stunned: true, ending: true, patronGod: "" })).toEqual({ amount: 1, clear: true });
  });
  it("Оглушения уже нет — флаг снимается без Порчи; флага нет — ничего", () => {
    expect(stunTaintStep(TAINT, { stunned: false, ending: false, patronGod: "" })).toEqual({ amount: 0, clear: true });
    expect(stunTaintStep(null, { stunned: true, ending: false, patronGod: "" })).toEqual({ amount: 0, clear: false });
  });
});

describe("triggerAfterEffect: Струп ставит флаг Порчи на актора", () => {
  function scabItem() {
    const doc = realScab();
    const item = {
      id: "scab", name: doc.name, type: "drug", flags: structuredClone(doc.flags),
      system: { ...structuredClone(doc.system), activeEffect: { isActive: true, roundsRemaining: 0 } },
      update: async () => {}
    };
    return item;
  }

  it("пост-эффект: Оглушение и флаг stunTaint в том же обновлении актора", async () => {
    const item = scabItem();
    const a = makeActor();
    captured.dice = [4];
    await triggerAfterEffect(a, item);
    expect(a.updates[0]).toMatchObject({
      "system.conditions.stunned": true,
      "system.conditions.stunnedRounds": 4,
      [`flags.${NS}.${STUN_TAINT_ACTOR_FLAG}`]: { perTurn: 1, exemptPatron: "nurgle", source: item.name }
    });
  });

  it("карточка не велит вписывать Порчу руками во время боя", async () => {
    const item = scabItem();
    const a = makeActor();
    captured.dice = [4];
    await triggerAfterEffect(a, item);
    expect(captured.chat[0].content).not.toMatch(/впишите на листе по ходу/);
    expect(captured.chat[0].content).toMatch(/в начале каждого Вашего Хода/);
  });
});

describe("processConditionTurnStart: Порча за Ход Оглушения", () => {
  it("Оглушён, не Нургл — +1 Порчи, строка в чате, счётчик Раундов тикает", async () => {
    const a = makeActor({ conditions: { stunned: true, stunnedRounds: 3 }, taint: TAINT, patronGod: "khorne" });
    await processConditionTurnStart(a);
    expect(a.system.corruption.value).toBe(11);
    expect(a.system.conditions.stunnedRounds).toBe(2);
    expect(captured.chat.some(c => /Порч/.test(c.content) && c.content.includes("Струп"))).toBe(true);
    expect(a.flags[NS][STUN_TAINT_ACTOR_FLAG]).toEqual(TAINT);
  });

  it("Покровитель Нургл — Порча не растёт", async () => {
    const a = makeActor({ conditions: { stunned: true, stunnedRounds: 3 }, taint: TAINT, patronGod: "nurgle" });
    await processConditionTurnStart(a);
    expect(a.system.corruption.value).toBe(10);
  });

  it("последний Ход Оглушения (1 → 0) — Порча начислена, флаг снят", async () => {
    const a = makeActor({ conditions: { stunned: true, stunnedRounds: 1 }, taint: TAINT });
    await processConditionTurnStart(a);
    expect(a.system.corruption.value).toBe(11);
    expect(a.updates.some(u => u[`flags.${NS}.-=${STUN_TAINT_ACTOR_FLAG}`] === null)).toBe(true);
  });

  it("Оглушения нет, флаг остался — Порчи нет, флаг снят", async () => {
    const a = makeActor({ conditions: { stunned: false }, taint: TAINT });
    await processConditionTurnStart(a);
    expect(a.system.corruption.value).toBe(10);
    expect(a.updates.some(u => u[`flags.${NS}.-=${STUN_TAINT_ACTOR_FLAG}`] === null)).toBe(true);
  });

  it("Оглушён без флага Струпа (другая причина) — Порчи нет", async () => {
    const a = makeActor({ conditions: { stunned: true, stunnedRounds: 2 } });
    await processConditionTurnStart(a);
    expect(a.system.corruption.value).toBe(10);
  });

  it("Порча не выше 100", async () => {
    const a = makeActor({ conditions: { stunned: true, stunnedRounds: 2 }, taint: TAINT, corruption: 100 });
    await processConditionTurnStart(a);
    expect(a.system.corruption.value).toBe(100);
  });

  it("Порча идёт отдельным обновлением system.corruption.value (для перехвата preUpdateActor)", async () => {
    const a = makeActor({ conditions: { stunned: true, stunnedRounds: 2 }, taint: TAINT });
    await processConditionTurnStart(a);
    expect(a.updates).toContainEqual({ "system.corruption.value": 11 });
  });
});
