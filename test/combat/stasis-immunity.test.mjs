// test/combat/stasis-immunity.test.mjs
//
// Стазис (wdbc-1rno, новое Состояние по прямому запросу пользователя, на
// основе находки Fruit of Flesh/Плода Плоти — субмутация «Оглушение»):
// «абсолютно неуязвимы... даже пинок Титана неспособен как-то повредить» —
// TOTAL_IMMUNITY-гейт в applyDamageToActor, до брони/Ран/Крит-эффектов.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ stasis = false, wounds = 20 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Замороженный", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds },
      conditions: { stasis }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 30, penetration: 10, damageType: "impact", hitLocation: "Торс",
  attackerName: "Титан", weaponName: "Пинок", ...over
});

beforeEach(resetCaptured);

describe("Стазис — абсолютный иммунитет к урону", () => {
  it("в Стазисе — попадание не отнимает ни одной Раны, никаких обновлений актора", async () => {
    const actor = characterActor({ stasis: true });
    await applyDamageToActor(actor, damage());
    expect(actor.system.wounds.value).toBe(20);
    expect(actor.updates).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("Стазис");
  });

  it("не в Стазисе — обычный урон проходит как всегда", async () => {
    const actor = characterActor({ stasis: false });
    await applyDamageToActor(actor, damage());
    expect(actor.system.wounds.value).toBeLessThan(20);
  });

  it("даже огромный непоглощаемый урон (Варп-оружие/Освящённое) в Стазисе не проходит", async () => {
    const actor = characterActor({ stasis: true });
    await applyDamageToActor(actor, damage({ rawDamage: 999, warpSoak: true, sanctified: true }));
    expect(actor.system.wounds.value).toBe(20);
  });
});
