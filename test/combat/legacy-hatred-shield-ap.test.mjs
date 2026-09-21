// test/combat/legacy-hatred-shield-ap.test.mjs
//
// Щит Ненависти/vigilant 9-9, Оружие Наследия (wdbc-1rno.35, стр. 427):
// временный +½Inf.b(окр.▲) AP руке(рукам), держащей оружие, и Торсу —
// проверяется прямо через applyDamageToActor/damage.mjs, тем же приёмом,
// что test/combat/damage-extreme-floor.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

beforeEach(resetCaptured);

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, hatredShield = null } = {}) {
  return {
    id: "char1", name: "Носитель", type: "character", uuid: "Actor.char1",
    system: {
      absorption: { body: armorAP + toughnessBonus, rightArm: armorAP + toughnessBonus, leftArm: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([], { contents: [] }),
    getFlag: (_scope, key) => (key === "legacyHatredShield" ? hatredShield : undefined),
    async update(data) {
      if (data["system.wounds.value"] !== undefined) this.system.wounds.value = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "impact", attackerName: "Стрелок", weaponName: "Тест", ...over
});

describe("Щит Ненависти: AP-бонус попадает в поглощение нужной зоны", () => {
  it("Торс покрыт всегда — попадание в Торс поглощается полностью с бонусом", () => {
    const actor = characterActor({ armorAP: 2, hatredShield: { weaponId: "w1", bonus: 3, arms: ["rightArm"] } });
    return applyDamageToActor(actor, damage({ rawDamage: 5, hitLocation: "Торс" })).then(() => {
      expect(actor.system.wounds.value).toBe(20); // AP 2+бонус 3 = 5 ≥ урон 5
    });
  });

  it("та же броня в Торс, БЕЗ флага — бонуса нет, урон проходит", async () => {
    const actor = characterActor({ armorAP: 2, hatredShield: null });
    await applyDamageToActor(actor, damage({ rawDamage: 5, hitLocation: "Торс" }));
    expect(actor.system.wounds.value).toBe(17); // 5-2=3
  });

  it("рука, покрытая флагом (rightArm) — бонус применяется", async () => {
    const actor = characterActor({ armorAP: 2, hatredShield: { weaponId: "w1", bonus: 3, arms: ["rightArm"] } });
    await applyDamageToActor(actor, damage({ rawDamage: 5, hitLocation: "П. Рука" }));
    expect(actor.system.wounds.value).toBe(20); // 2+3=5 ≥ 5
  });

  it("рука, НЕ покрытая флагом (leftArm не в arms) — бонуса нет", async () => {
    const actor = characterActor({ armorAP: 2, hatredShield: { weaponId: "w1", bonus: 3, arms: ["rightArm"] } });
    await applyDamageToActor(actor, damage({ rawDamage: 5, hitLocation: "Л. Рука" }));
    expect(actor.system.wounds.value).toBe(17); // leftArm тоже 2 AP базово, бонус не покрывает её
  });
});
