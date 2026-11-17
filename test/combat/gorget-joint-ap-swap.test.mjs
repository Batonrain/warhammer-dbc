// test/combat/gorget-joint-ap-swap.test.mjs
//
// Gorget / Горжет (книга, «Броня»): «Избирательные атаки в сочленения шеи
// этой брони... при попадании используют АР торса, а не головы, если она
// выше (но уменьшают её как обычно при попадании в сочленения)». Попадание
// "Сочленение / Шея" маппится на armorKey "head" (combat/damage.mjs,
// LOCATION_TO_ARMOR) — Горжет подменяет только ИСТОЧНИК AP, не саму локацию.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ head, body, gorgetRating = 0, wounds = 30 } = {}) {
  const items = Object.assign([], { contents: [] });
  return {
    id: "char1", name: "Носитель Горжета", type: "character", uuid: "Actor.char1", items,
    system: {
      absorption: {
        head, body, toughnessBonus: 0,
        propFlags: { head: { gorgetRating }, body: {} }
      },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    },
    async updateEmbeddedDocuments() {}
  };
}

const jointHit = (over = {}) => ({
  rawDamage: 20, penetration: 0, damageType: "impact", hitLocation: "Сочленение / Шея",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

describe("Горжет: АР торса вместо головы на попадании в сочленение/шею", () => {
  it("торс выше головы и есть Горжет — используется AP торса (÷3 как обычно)", async () => {
    const actor = characterActor({ head: 2, body: 10, gorgetRating: 5 });
    await applyDamageToActor(actor, jointHit());
    // floor(10/3)=3 поглощено → 20-3=17 потеряно Ран.
    expect(actor.system.wounds.value).toBe(30 - 17);
  });

  it("без Горжета (gorgetRating 0) — используется обычная AP головы", async () => {
    const actor = characterActor({ head: 2, body: 10, gorgetRating: 0 });
    await applyDamageToActor(actor, jointHit());
    // floor(2/3)=0 поглощено → весь урон проходит.
    expect(actor.system.wounds.value).toBe(30 - 20);
  });

  it("Горжет есть, но голова выше торса — подмены нет, используется AP головы", async () => {
    const actor = characterActor({ head: 10, body: 2, gorgetRating: 5 });
    await applyDamageToActor(actor, jointHit());
    // floor(10/3)=3 — та же цифра, что и у головы (не хуже головы).
    expect(actor.system.wounds.value).toBe(30 - 17);
  });
});
