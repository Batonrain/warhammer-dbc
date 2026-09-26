// test/combat/toxic-nonliving.test.mjs
//
// Виды Урона (wdbc-x1nz.2.82): C(Tx) «действует только на живых существ».
// Решение Сергея 23.09.2026: неживые — Техника и Укрытия. Укрытия в системе —
// зоны сцены без прочности, урона не получают; остаётся Техника.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function vehicle() {
  const updates = [];
  return {
    id: "v1", name: "Химера", type: "vehicle", uuid: "Actor.v1", items: [], updates,
    system: { structure: { value: 30, max: 30 }, armour: { front: 5, side: 5, rear: 5 } },
    getFlag: () => undefined, async unsetFlag() {}, async setFlag() {},
    async update(d) { updates.push(d); }
  };
}

beforeEach(resetCaptured);

describe("C(Tx) по Технике", () => {
  it("токсический урон машину не повреждает и говорит об этом", async () => {
    const v = vehicle();
    await applyDamageToActor(v, { rawDamage: 20, damageType: "chemical", damageSubtype: "toxic", hitLocation: "Корпус" });
    expect(v.updates).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("только на живых");
  });
});
