// test/combat/suppression.test.mjs
//
// Подавление (стр. 32-33): тест W+0, тест Морали. Провал → conditions.pinned.
// Снимается тестом W+0 (+30 по решению ГМ) в конце Хода Подавленного.
// Раньше conditions.pinned был флагом без единого механического следствия —
// теперь есть сам тест, который его накладывает/снимает.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { suppressionTestMod, rollSuppressionTest, rollSuppressionRecovery,
         postSuppressionRecoveryPrompt } from "../../module/combat/suppression.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

function actor({ wp = 40, pinned = false } = {}) {
  const a = {
    id: "actor-1", name: "Стрелок", uuid: "Actor.actor-1",
    system: { characteristics: { wp: { total: wp } }, conditions: { pinned } },
    async update(data) {
      if ("system.conditions.pinned" in data) this.system.conditions.pinned = data["system.conditions.pinned"];
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("suppressionTestMod: штраф зависит от RoF, не от класса оружия", () => {
  it("оружие с автоматической RoF (rof_full > 0) — −20", () => {
    expect(suppressionTestMod({ rof_semi: 2, rof_full: 6 })).toBe(-20);
  });
  it("только полуавтомат (rof_full = 0) — −10", () => {
    expect(suppressionTestMod({ rof_semi: 2, rof_full: 0 })).toBe(-10);
  });
  it("нет rof_full вовсе — −10", () => {
    expect(suppressionTestMod({ rof_semi: 2 })).toBe(-10);
  });
});

describe("rollSuppressionTest", () => {
  it("успех — не накладывает Подавление", async () => {
    captured.nextRoll = 10; // WP 40+0 → порог 40, 10 ≤ 40 успех
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("провал — накладывает conditions.pinned", async () => {
    captured.nextRoll = 90; // порог 40, 90 > 40 провал
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(false);
    expect(a.system.conditions.pinned).toBe(true);
  });

  it("штраф снижает порог — успех на 35 при mod −10 (порог 30) не проходит", async () => {
    captured.nextRoll = 35;
    const a = actor({ wp: 40 });
    const { success, threshold } = await rollSuppressionTest(a, { mod: -10 });
    expect(threshold).toBe(30);
    expect(success).toBe(false);
  });

  it("карточка называет источник и показывает исход", async () => {
    captured.nextRoll = 10;
    const a = actor({ wp: 40 });
    await rollSuppressionTest(a, { mod: -10, sourceLabel: "Стрельба на подавление" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Стрельба на подавление");
    expect(card).toContain("Порог: <b>30</b>");
    expect(card).toContain("Успех");
  });
});

describe("rollSuppressionRecovery", () => {
  it("успех снимает conditions.pinned", async () => {
    captured.nextRoll = 10;
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("провал оставляет conditions.pinned как есть", async () => {
    captured.nextRoll = 90;
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(false);
    expect(a.system.conditions.pinned).toBe(true);
  });

  it("бонус +30 поднимает порог", async () => {
    captured.nextRoll = 65;
    const a = actor({ wp: 40, pinned: true });
    const { success, threshold } = await rollSuppressionRecovery(a, { bonus: 30 });
    expect(threshold).toBe(70);
    expect(success).toBe(true);
  });
});

// Lord of the Exodites (wdbc-zepq): бонус/переброс с областью "morale" из
// реестра правил применяются автоматически — у Подавления нет диалога.
describe("интеграция с реестром правил (область morale)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("rollSuppressionTest: rollBonus с target morale поднимает порог автоматически", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура", effects: [{ kind: "rollBonus", target: "morale", value: 30 }] }
    ]);
    captured.nextRoll = 65; // порог 40+30=70, 65 ≤ 70 успех
    const a = actor({ wp: 40 });
    const { success, threshold } = await rollSuppressionTest(a, { mod: 0 });
    expect(threshold).toBe(70);
    expect(success).toBe(true);
  });

  it("rollSuppressionRecovery: rollMode с target morale даёт переброс (keepBest)", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура", effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2 }] }
    ]);
    captured.dice = [90, 10]; // без переброса — провал (90>40), с переброском — лучший (10) успех
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(true);
  });
});

describe("postSuppressionRecoveryPrompt", () => {
  it("публикует карточку с двумя кнопками (+0 и +30)", async () => {
    const a = actor({ wp: 40, pinned: true });
    await postSuppressionRecoveryPrompt(a);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-suppression-recovery-btn");
    expect(card).toContain('data-bonus="0"');
    expect(card).toContain('data-bonus="30"');
    expect(card).toContain(`data-actor-uuid="${a.uuid}"`);
  });
});
