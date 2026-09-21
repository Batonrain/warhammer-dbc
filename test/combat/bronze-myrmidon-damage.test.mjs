// test/combat/bronze-myrmidon-damage.test.mjs
//
// Bronze Myrmidon / Бронзовый Мирмидон (Дар Кхорна, wdbc-1rno.1): попадания
// в Сочленение/Глаз резолвятся как попадания в Руку/Голову для актора с
// активным Трейтом Machine — интеграция в applyDamageToActor через
// module/rules/bronze-myrmidon.mjs::redirectHitLocationForMachine.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const MACHINE_TRAIT = { id: "t1", type: "trait", name: "Machine / Машина (4)" };

function characterActor({ withMachineTrait = false } = {}) {
  const items = withMachineTrait ? [MACHINE_TRAIT] : [];
  return {
    id: "char1", name: "Жертва", type: "character", uuid: "Actor.char1",
    system: {
      absorption: {
        head: 17, rightArm: 13, toughnessBonus: 5,
        propFlags: {}, wornOnly: { head: 12 }
      },
      wounds: { value: 40, critical: 0, max: 40 }
    },
    items: Object.assign(items, { contents: items }),
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(1);
        let cur = this.system;
        for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
        cur[keys.at(-1)] = value;
      }
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 30, penetration: 0, damageType: "impact",
  attackerName: "Нападающий", weaponName: "Кулак", ...over
});

beforeEach(resetCaptured);

describe("applyDamageToActor: Bronze Myrmidon — редирект Сочленение/Глаз → Рука/Голова", () => {
  it("без Трейта Machine: Сочленение/Шея — AP÷3 (голова 12 → 4), Раны 40 → 19", async () => {
    const actor = characterActor({ withMachineTrait: false });
    await applyDamageToActor(actor, damage({ hitLocation: "Сочленение / Шея" }));
    // netDamage = 30 − (4 AP + 5 T.b) = 21
    expect(actor.system.wounds.value).toBe(19);
  });

  it("с Трейтом Machine: Сочленение/Шея → Рука, полный AP (8), Раны 40 → 23", async () => {
    const actor = characterActor({ withMachineTrait: true });
    await applyDamageToActor(actor, damage({ hitLocation: "Сочленение / Шея" }));
    // netDamage = 30 − (8 AP + 5 T.b) = 17
    expect(actor.system.wounds.value).toBe(23);
  });

  it("без Трейта Machine: Глаз (Голова) — AP шлема игнорируется (natural=0), Раны 40 → 15", async () => {
    const actor = characterActor({ withMachineTrait: false });
    await applyDamageToActor(actor, damage({ hitLocation: "Глаз (Голова)" }));
    // netDamage = 30 − (0 AP + 5 T.b) = 25
    expect(actor.system.wounds.value).toBe(15);
  });

  it("с Трейтом Machine: Глаз (Голова) → Голова, полный AP (12), Раны 40 → 27", async () => {
    const actor = characterActor({ withMachineTrait: true });
    await applyDamageToActor(actor, damage({ hitLocation: "Глаз (Голова)" }));
    // netDamage = 30 − (12 AP + 5 T.b) = 13
    expect(actor.system.wounds.value).toBe(27);
  });

  it("с Трейтом Machine: обычный Торс не задет редиректом (не Сочленение/Глаз)", async () => {
    const actor = characterActor({ withMachineTrait: true });
    await applyDamageToActor(actor, damage({ hitLocation: "Торс" }));
    // Торс не мапится ни на head, ни на rightArm — armorKey "body" не задан в
    // фикстуре absorption (0 AP), netDamage = 30 − (0 + 5) = 25.
    expect(actor.system.wounds.value).toBe(15);
  });
});
