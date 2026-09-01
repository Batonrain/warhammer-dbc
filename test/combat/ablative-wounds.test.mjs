// test/combat/ablative-wounds.test.mjs
//
// Регенерация Аблативных Ран (wdbc-smy7): +1/Ход до ablativeMax, тем же
// приёмом, что Призма (test/combat/prisma.test.mjs).

import { describe, it, expect } from "vitest";
import { processAblativeWoundsTurnStart } from "../../module/combat/ablative-wounds.mjs";

function actor({ ablative = 0, ablativeMax = 0 } = {}) {
  const updates = [];
  return {
    system: { wounds: { ablative, ablativeMax } },
    updates,
    async update(data) {
      updates.push(data);
      if (data["system.wounds.ablative"] !== undefined) this.system.wounds.ablative = data["system.wounds.ablative"];
    }
  };
}

describe("processAblativeWoundsTurnStart", () => {
  it("нет пула (ablativeMax 0) — не трогает актора вовсе", async () => {
    const a = actor({ ablative: 0, ablativeMax: 0 });
    await processAblativeWoundsTurnStart(a);
    expect(a.updates).toHaveLength(0);
  });

  it("+1 к текущему запасу", async () => {
    const a = actor({ ablative: 4, ablativeMax: 10 });
    await processAblativeWoundsTurnStart(a);
    expect(a.system.wounds.ablative).toBe(5);
  });

  it("не поднимается выше максимума", async () => {
    const a = actor({ ablative: 10, ablativeMax: 10 });
    await processAblativeWoundsTurnStart(a);
    expect(a.system.wounds.ablative).toBe(10);
    expect(a.updates).toHaveLength(0);
  });

  it("нет актора — не падает", async () => {
    await expect(processAblativeWoundsTurnStart(null)).resolves.toBeUndefined();
  });
});
