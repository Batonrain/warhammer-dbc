// test/combat/stun-maneuver-damage.test.mjs
//
// Приём Оглушить (стр. 14, wdbc-x1nz.2.66.3): «Если эта атака нанесла
// непоглощённый урон, он игнорируется и вместо этого цель Оглушается на
// 1 Ход за каждый нечётный урон» — читается как ⌈netDamage/2⌉ Раундов.
// Проверяется на уровне applyDamageToActor(damageData.stunManeuver), тем же
// приёмом, что test/combat/saw-ignores-dome-shield.test.mjs.

import { resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ stunnedRounds = 0, toughnessBonus = 0 } = {}) {
  return {
    id: "char1", name: "Цель", type: "character",
    system: {
      absorption: { body: 0, toughnessBonus, propFlags: {}, wornOnly: {} },
      characteristics: { wp: { bonus: 20 } },
      conditions: { stunned: stunnedRounds > 0, stunnedRounds },
      fatigue: { value: 0, max: 10 },
      wounds: { value: 20, critical: 0, max: 20 }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      if (data["system.wounds.value"]      !== undefined) this.system.wounds.value      = data["system.wounds.value"];
      if (data["system.wounds.critical"]   !== undefined) this.system.wounds.critical   = data["system.wounds.critical"];
      if (data["system.fatigue.value"]     !== undefined) this.system.fatigue.value     = data["system.fatigue.value"];
      if (data["system.conditions.stunned"]       !== undefined) this.system.conditions.stunned       = data["system.conditions.stunned"];
      if (data["system.conditions.stunnedRounds"] !== undefined) this.system.conditions.stunnedRounds = data["system.conditions.stunnedRounds"];
    },
    async updateEmbeddedDocuments() { return []; }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Голова",
  attackerName: "Атакующий", weaponName: "Булава", melee: true, ...over
});

beforeEach(resetCaptured);

describe("Приём Оглушить: непоглощённый урон → Оглушение вместо Ран", () => {
  it("непоглощённый урон нечётный (5) — Оглушение на ⌈5/2⌉=3 Хода, Раны не теряются", async () => {
    const actor = characterActor();
    await applyDamageToActor(actor, damage({ rawDamage: 5, stunManeuver: true }));

    expect(actor.system.wounds.value).toBe(20); // ран не потеряно
    expect(actor.system.conditions.stunned).toBe(true);
    expect(actor.system.conditions.stunnedRounds).toBe(3);
  });

  it("непоглощённый урон чётный (4) — Оглушение на ⌈4/2⌉=2 Хода", async () => {
    const actor = characterActor();
    await applyDamageToActor(actor, damage({ rawDamage: 4, stunManeuver: true }));

    expect(actor.system.wounds.value).toBe(20);
    expect(actor.system.conditions.stunnedRounds).toBe(2);
  });

  it("урон полностью поглощён (T.b 20 ≥ rawDamage) — Оглушение не накладывается вовсе", async () => {
    const actor = characterActor({ toughnessBonus: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 3, stunManeuver: true }));

    expect(actor.system.wounds.value).toBe(20);
    expect(actor.system.conditions.stunned).toBe(false);
  });

  it("уже Оглушена на большее число Раундов — не уменьшает счётчик (берёт максимум)", async () => {
    const actor = characterActor({ stunnedRounds: 5 });
    await applyDamageToActor(actor, damage({ rawDamage: 5, stunManeuver: true })); // дал бы 3

    expect(actor.system.conditions.stunnedRounds).toBe(5);
  });

  it("та же атака БЕЗ Приёма Оглушить (stunManeuver не передан) — урон применяется как обычно, Оглушения нет", async () => {
    const actor = characterActor();
    await applyDamageToActor(actor, damage({ rawDamage: 5 }));

    expect(actor.system.wounds.value).toBeLessThan(20);
    expect(actor.system.conditions.stunned).toBe(false);
  });
});
