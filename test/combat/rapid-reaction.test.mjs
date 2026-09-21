// test/combat/rapid-reaction.test.mjs
//
// Rapid Reaction / Быстрая Реакция (wdbc-1rno.3): реакция на conditions.surprised
// (стр. 12) — тест A+0 в начале Хода, успех восстанавливает ОД/Реакции этого
// Хода вместо 0/0. Реагирует конкретно на Состояние начала боя, не на
// per-attack галочку «Цель Врасплох» (стр. 32, отдельное правило).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { hasRapidReaction } from "../../module/rules/rapid-reaction.mjs";
import { shouldOfferRapidReaction, postRapidReactionPrompt, rollRapidReactionTest } from "../../module/combat/rapid-reaction.mjs";

function actorFor({ ag = 40, surprised = true, hasTalent = true, actionPoints = { value: 0, max: 2 }, reactions = { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } } = {}) {
  const doc = {
    id: "a1", uuid: "Actor.a1", name: "Подставной",
    type: "character",
    items: hasTalent ? [{ id: "t1", name: "Rapid Reaction / Быстрая Реакция", type: "talent", system: {} }] : [],
    system: {
      meleeStance: "standard",
      characteristics: { ag: { total: ag } },
      actionPoints: { ...actionPoints },
      reactions: { ...reactions },
      conditions: { surprised }
    },
    getFlag: () => undefined,
    setFlag: async () => {},
    unsetFlag: async () => {}
  };
  doc.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

beforeEach(resetCaptured);

describe("hasRapidReaction", () => {
  it("находит талант по русскому и английскому имени", () => {
    expect(hasRapidReaction(actorFor({ hasTalent: true }))).toBe(true);
    expect(hasRapidReaction(actorFor({ hasTalent: false }))).toBe(false);
  });
});

describe("shouldOfferRapidReaction", () => {
  it("да — был Врасплох И есть Талант", () => {
    expect(shouldOfferRapidReaction(actorFor({ hasTalent: true }), true)).toBe(true);
  });
  it("нет — Врасплоха не было (снимок false), хоть Талант и есть", () => {
    expect(shouldOfferRapidReaction(actorFor({ hasTalent: true }), false)).toBe(false);
  });
  it("нет — нет Таланта, хоть Врасплох и был", () => {
    expect(shouldOfferRapidReaction(actorFor({ hasTalent: false }), true)).toBe(false);
  });
});

describe("postRapidReactionPrompt", () => {
  it("публикует карточку с кнопкой теста", async () => {
    const a = actorFor();
    await postRapidReactionPrompt(a);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-rapid-reaction-btn");
    expect(card).toContain(`data-actor-uuid="${a.uuid}"`);
  });
});

describe("rollRapidReactionTest", () => {
  // В реальном такте (hooks.mjs) к моменту клика по кнопке conditions.surprised
  // уже снят ПЕРВЫМ вызовом resetActionEconomy (он же обнулил ОД/Реакции) —
  // здесь фикстура воспроизводит именно это состояние «после первого сброса»,
  // а не сырое «только что застигнут».
  it("успех — восстанавливает ОД/Реакции этого Хода (повторный resetActionEconomy)", async () => {
    captured.nextRoll = 10; // Ag 40+0 → порог 40, успех
    const a = actorFor({ ag: 40, surprised: false, actionPoints: { value: 0, max: 2 }, reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    const { success } = await rollRapidReactionTest(a);
    expect(success).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.system.reactions.value).toBe(1);
  });

  it("провал — ОД/Реакции остаются как есть (0/0, resetActionEconomy не вызван)", async () => {
    captured.nextRoll = 90;
    const a = actorFor({ ag: 40, surprised: false, actionPoints: { value: 0, max: 2 }, reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    const { success } = await rollRapidReactionTest(a);
    expect(success).toBe(false);
    expect(a.system.actionPoints.value).toBe(0);
    expect(a.system.reactions.value).toBe(0);
  });

  it("карточка сообщает исход", async () => {
    captured.nextRoll = 10;
    const a = actorFor({ ag: 40 });
    await rollRapidReactionTest(a);
    expect(captured.chat.at(-1).content).toContain("Быстрая Реакция");
    expect(captured.chat.at(-1).content).toContain("Успех");
  });
});
