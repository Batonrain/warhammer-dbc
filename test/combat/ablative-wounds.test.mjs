// test/combat/ablative-wounds.test.mjs
//
// Регенерация Аблативных Ран (wdbc-smy7): +1/Ход, тем же приёмом, что Призма
// (test/combat/prisma.test.mjs). С wdbc-x1nz.2.86 — только у источника, где
// реген прописан текстом («Абсурдно Толстый»), и только до его доли пула:
// «аблативные Раны, если не указано обратного, не могут быть вылечены».

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { processAblativeWoundsTurnStart, ablativeRegenCap, ABSURDLY_FAT_CAPABILITY }
  from "../../module/combat/ablative-wounds.mjs";
import { clearRuleSources, registerRuleSource } from "../../module/rules/sources.mjs";

function actor({ ablative = 0, ablativeMax = 0 } = {}) {
  const updates = [];
  return {
    items: [], getFlag: () => undefined,
    system: { wounds: { ablative, ablativeMax } },
    updates,
    async update(data) {
      updates.push(data);
      if (data["system.wounds.ablative"] !== undefined) this.system.wounds.ablative = data["system.wounds.ablative"];
    }
  };
}

let fat = false;
beforeEach(() => {
  fat = false;
  clearRuleSources();
  registerRuleSource("test", () => fat
    ? [{ id: "test.fat", when: {}, effects: [{ kind: "grantFlag", target: ABSURDLY_FAT_CAPABILITY }] }]
    : []);
});
afterEach(() => clearRuleSources());

describe("processAblativeWoundsTurnStart", () => {
  it("нет пула (ablativeMax 0) — не трогает актора вовсе", async () => {
    fat = true;
    const a = actor({ ablative: 0, ablativeMax: 0 });
    await processAblativeWoundsTurnStart(a);
    expect(a.updates).toHaveLength(0);
  });

  it("«Абсурдно Толстый» — +1 к текущему запасу", async () => {
    fat = true;
    const a = actor({ ablative: 4, ablativeMax: 10 });
    await processAblativeWoundsTurnStart(a);
    expect(a.system.wounds.ablative).toBe(5);
  });

  it("не поднимается выше максимума", async () => {
    fat = true;
    const a = actor({ ablative: 10, ablativeMax: 10 });
    await processAblativeWoundsTurnStart(a);
    expect(a.system.wounds.ablative).toBe(10);
    expect(a.updates).toHaveLength(0);
  });

  it("пул без регенерирующего источника (Терминаторская броня и т.п.) — не отрастает", async () => {
    const a = actor({ ablative: 4, ablativeMax: 10 });
    await processAblativeWoundsTurnStart(a);
    expect(a.updates).toHaveLength(0);
  });

  it("смешанный пул: отрастает только доля Толстого (10 из 20)", async () => {
    fat = true;
    const a = actor({ ablative: 10, ablativeMax: 20 });
    expect(ablativeRegenCap(a)).toBe(10);
    await processAblativeWoundsTurnStart(a);
    expect(a.updates).toHaveLength(0);
  });

  it("нет актора — не падает", async () => {
    await expect(processAblativeWoundsTurnStart(null)).resolves.toBeUndefined();
  });
});
