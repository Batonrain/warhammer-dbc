// test/combat/legacy-weapon-excess.test.mjs
//
// Наследие Излишеств, Оружие Наследия, вторая половина (wdbc-1rno.35,
// История 6, стр. 427): «...если проваливает этот тест [с выбранным +10],
// должен пройти тест на W+0 или получить 1 Порчи.» Каскад сам по себе — тот
// же приём харнесса, что test/combat/quick-to-anger.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { rollExcessLegacyRiskTest } from "../../module/combat/legacy-weapon-excess.mjs";

function actor({ wpTotal = 40, cor = 0 } = {}) {
  const updates = [];
  return {
    id: "a1", name: "Чемпион", items: [],
    system: { characteristics: { wp: { bonus: 0, total: wpTotal } }, corruption: { value: cor } },
    updates,
    async update(data) {
      updates.push(data);
      if (data["system.corruption.value"] !== undefined) this.system.corruption.value = data["system.corruption.value"];
    }
  };
}

const card = () => captured.chat.find(c => c.content.includes("Наследие Излишеств"));

beforeEach(() => { resetCaptured(); });

describe("rollExcessLegacyRiskTest", () => {
  it("провал (W 40, бросок 90) — +1 Порчи, карточка «Провал»", async () => {
    const a = actor({ wpTotal: 40, cor: 2 });
    captured.nextRoll = 90;
    const success = await rollExcessLegacyRiskTest(a);
    expect(success).toBe(false);
    expect(a.system.corruption.value).toBe(3);
    expect(card().content).toContain("Провал");
  });

  it("успех (W 40, бросок 10) — Порча не растёт", async () => {
    const a = actor({ wpTotal: 40, cor: 2 });
    captured.nextRoll = 10;
    const success = await rollExcessLegacyRiskTest(a);
    expect(success).toBe(true);
    expect(a.system.corruption.value).toBe(2);
    expect(card().content).toContain("Успех");
  });
});
