// test/combat/shock-recovery.test.mjs
//
// «В Шоке» (стр. 53, wdbc-zepq) — новое персистентное состояние: провал
// теста Страха с реальным (не предотвращённым Infamy) результатом по таблице
// Шока ставит conditions.shocked; снимается тестом выхода из Шока (W+0, тест
// Морали) в начале следующего Хода.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { _executeFearRoll, rollShockRecovery, postShockRecoveryPrompt } from "../../module/combat/fear.mjs";

function actor({ wp = 40, shocked = false } = {}) {
  const updates = [];
  return {
    id: "a1", uuid: "Actor.a1", name: "Подставной", items: [],
    system: { characteristics: { wp: { total: wp } }, fatigue: { value: 0 }, fate: { value: 0 },
              conditions: { shocked } },
    updates,
    getFlag: () => undefined,
    async update(data) {
      updates.push(data);
      if ("system.conditions.shocked" in data) this.system.conditions.shocked = data["system.conditions.shocked"];
    }
  };
}

beforeEach(resetCaptured);

describe("_executeFearRoll: устанавливает conditions.shocked при реальном Шоке", () => {
  it("провал, Шок не предотвращён Infamy — ставит conditions.shocked", async () => {
    const a = actor();
    captured.nextRoll = 99; // гарантированный провал теста Страха
    captured.dice = [99, 80]; // 1) тест Страха 99, 2) бросок по таблице Шока 80
    await _executeFearRoll(a, 1, "important", 0, 0);
    expect(a.system.conditions.shocked).toBe(true);
  });

  it("провал, но Шок предотвращён высокой Infamy — не ставит conditions.shocked", async () => {
    const a = actor();
    captured.dice = [99, 5]; // тест Страха 99 (провал 1 степень) → бросок Шока 5+10*0-infamy
    await _executeFearRoll(a, 1, "important", 20, 0); // infamy=20 ≥ бросок 5 → total ≤ 0
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("успех теста Страха — Шок не ставится", async () => {
    const a = actor();
    captured.nextRoll = 5; // гарантированный успех
    await _executeFearRoll(a, 1, "important", 0, 0);
    expect(a.system.conditions.shocked).toBe(false);
  });
});

describe("rollShockRecovery", () => {
  it("успех снимает conditions.shocked", async () => {
    captured.nextRoll = 10; // W 40+0 → порог 40, успех
    const a = actor({ wp: 40, shocked: true });
    const { success } = await rollShockRecovery(a);
    expect(success).toBe(true);
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("провал оставляет conditions.shocked как есть", async () => {
    captured.nextRoll = 90;
    const a = actor({ wp: 40, shocked: true });
    const { success } = await rollShockRecovery(a);
    expect(success).toBe(false);
    expect(a.system.conditions.shocked).toBe(true);
  });

  it("карточка сообщает исход", async () => {
    captured.nextRoll = 10;
    const a = actor({ wp: 40, shocked: true });
    await rollShockRecovery(a);
    expect(captured.chat.at(-1).content).toContain("Выход из Шока");
    expect(captured.chat.at(-1).content).toContain("Успех");
  });
});

describe("postShockRecoveryPrompt", () => {
  it("публикует карточку с кнопкой теста", async () => {
    const a = actor({ shocked: true });
    await postShockRecoveryPrompt(a);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-shock-recovery-btn");
    expect(card).toContain(`data-actor-uuid="${a.uuid}"`);
  });
});
