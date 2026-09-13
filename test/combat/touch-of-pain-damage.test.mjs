// test/combat/touch-of-pain-damage.test.mjs
//
// Touch of Pain / Касание Боли (Дар Слаанеш, wdbc-1rno): T.b Поглощения
// этой атаки игнорируется целиком — интеграция в applyDamageToActor.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ armorAP = 0, toughnessBonus = 5, wounds = 20 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Жертва", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: {
        body: armorAP + toughnessBonus, toughnessBonus, propFlags: {},
        armorOnly: { head: armorAP, body: armorAP, leftArm: armorAP, rightArm: armorAP, leftLeg: armorAP, rightLeg: armorAP }
      },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      updates.push(data);
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
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Нападающий", weaponName: "Кулак", ...over
});

beforeEach(resetCaptured);

describe("applyDamageToActor: Touch of Pain — T.b Поглощения проигнорирован", () => {
  it("без находки — T.b поглощает как обычно (Раны падают на raw−AP−T.b)", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 5, wounds: 20 });
    await applyDamageToActor(actor, damage());
    // rawNet = 10 − (0 AP + 5 T.b) = 5
    expect(actor.system.wounds.value).toBe(15);
  });

  it("с touchOfPainIgnoreTb — T.b обнулён, Раны падают сильнее", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 5, wounds: 20 });
    await applyDamageToActor(actor, damage({ touchOfPainIgnoreTb: true }));
    // rawNet = 10 − (0 AP + 0 T.b) = 10
    expect(actor.system.wounds.value).toBe(10);
  });

  it("флаг без AP/T.b вообще — ничего не ломает (нечего игнорировать)", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ touchOfPainIgnoreTb: true }));
    expect(actor.system.wounds.value).toBe(10);
  });
});
