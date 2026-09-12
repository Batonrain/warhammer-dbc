// test/combat/damage-actor-update-batch.test.mjs
//
// wdbc-ye6 (пункт 6): applyDamageToActor (module/combat/damage.mjs) писало
// armorCorrosion (Касание Энтропии), ablativeApShield и sarcophagusWarpWounds
// тремя ОТДЕЛЬНЫМИ actor.update() на одно попадание — три круга до сервера и
// три перерисовки листа вместо одной. Теперь они копятся в один объект и
// уходят одним вызовом. Тест ловит именно КОЛИЧЕСТВО вызовов update() — сами
// применённые значения уже проверены по отдельности в weapon-property-effects
// (Corrosive и т.п.) и ablative-ap-pool.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Персонаж с Касанием Энтропии + аблативным AP-щитом одновременно активными. */
function characterActor({ armorAP = 10, shieldValue = 2, wounds = 20 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: {
        body: armorAP, toughnessBonus: 0, propFlags: {},
        armorOnly: { head: armorAP, body: armorAP, leftArm: armorAP, rightArm: armorAP, leftLeg: armorAP, rightLeg: armorAP }
      },
      wounds: { value: wounds, critical: 0, max: wounds },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      ablativeApShield: { value: shieldValue, max: shieldValue }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(1); // отбрасываем "system"
        let cur = this.system;
        for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
        cur[keys.at(-1)] = value;
      }
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 1, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(resetCaptured);

describe("applyDamageToActor: правки самого актора одним update()", () => {
  it("Касание Энтропии + аблативный AP-щит на одном попадании — ОДИН actor.update(), не два", async () => {
    const actor = characterActor({ armorAP: 10, shieldValue: 2 });
    await applyDamageToActor(actor, damage({ entropyRating: 3 }));

    expect(actor.updates).toHaveLength(1);
    expect(actor.updates[0]).toMatchObject({
      "system.armorCorrosion.body": 3,
      "system.ablativeApShield.value": 1
    });
    expect(actor.system.armorCorrosion.body).toBe(3);
    expect(actor.system.ablativeApShield.value).toBe(1);
  });

  it("ничего из троицы не сработало — actor.update() вовсе не вызывается", async () => {
    const actor = characterActor({ armorAP: 10, shieldValue: 0 });
    await applyDamageToActor(actor, damage({}));
    expect(actor.updates).toHaveLength(0);
  });
});
