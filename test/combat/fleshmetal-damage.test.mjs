// test/combat/fleshmetal-damage.test.mjs
//
// Плотеметалл (Sahara 3-cc96 п.8): оружие со свойством Sanctified игнорирует AP
// от Трейта Machine — через настоящую applyDamageToActor, не только чистую функцию.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const talent = { id: "t1", type: "talent", name: "Fleshmetal / Плотеметалл", system: {}, flags: {} };
const machine = rating => ({ id: "m1", type: "trait", name: "Machine / Машина (X)", system: { rating }, flags: {} });

/** Торс: броня = AP Machine (3), Бонус Стойкости 0 — весь AP тела именно от Machine. */
function actorWith(items) {
  const actor = {
    id: "char1", name: "Техножрец", type: "character",
    system: {
      absorption: { body: 3, toughnessBonus: 0, propFlags: {} },
      wounds: { value: 30, critical: 0, max: 30 }
    },
    items: Object.assign([...items], { contents: items }),
    getFlag: () => undefined, async unsetFlag() {},
    async update(data) {
      if (data["system.wounds.value"] !== undefined) actor.system.wounds.value = data["system.wounds.value"];
    }
  };
  return actor;
}
const hit = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "energy", hitLocation: "Торс",
  attackerName: "Инквизитор", weaponName: "Освящённый клинок", ...over
});

beforeEach(resetCaptured);

describe("Плотеметалл: Sanctified снимает AP от Machine (applyDamageToActor)", () => {
  it("обычное оружие: Machine(3) поглощает 3 из 10", async () => {
    const a = actorWith([talent, machine(3)]);
    await applyDamageToActor(a, hit());
    expect(30 - a.system.wounds.value).toBe(7);
  });

  it("Sanctified: AP Machine игнорируется — урон проходит целиком", async () => {
    const a = actorWith([talent, machine(3)]);
    await applyDamageToActor(a, hit({ sanctified: true }));
    expect(30 - a.system.wounds.value).toBe(10);
  });

  it("Sanctified против Machine БЕЗ Плотеметалла — броня Machine держит, как всегда", async () => {
    const a = actorWith([machine(3)]);
    await applyDamageToActor(a, hit({ sanctified: true }));
    expect(30 - a.system.wounds.value).toBe(7);
  });
});
