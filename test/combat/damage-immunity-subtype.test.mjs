// test/combat/damage-immunity-subtype.test.mjs
//
// damageImmunity.subtype.* (wdbc-q0q8) — полный иммунитет к урону по
// КОНКРЕТНОМУ подвиду в скобках книги (I(Cr)/X(Fr)/E(El)/E(Fl)/E(Ls)/C(Tx)),
// на уровень точнее weaponPropertyImmunity.*/damageImmunity.melee*/rangedImpact
// (wdbc-1rno, test/combat/strange-invulnerability-damage.test.mjs) — та же
// роль (ранний return в applyDamageToActor до расчёта поглощения), но гейт
// по system.damageSubtype, а не по свойству оружия/широкому damageType.
// Вынесено в отдельный файл (не дописано в strange-invulnerability-damage
// напрямую), т.к. эта запись независима от субмутаций Странной Неуязвимости.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Подставной Персонаж с capability-предметом по запрошенному ключу. */
function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, capabilityKeys = [] } = {}) {
  const items = capabilityKeys.map((key, i) => ({
    id: `immunity-item-${i}`, name: "Иммунитет к подвиду", type: "mutation",
    system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(resetCaptured);

describe("damageImmunity.subtype.* — полный иммунитет по подвиду урона в скобках книги (wdbc-q0q8)", () => {
  it("без damageSubtype на попадании — иммунитет не срабатывает даже с ключом на акторе", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, capabilityKeys: ["damageImmunity.subtype.electrical"] });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "energy" }));
    expect(actor.system.wounds.value).toBe(5);
  });

  it("damageImmunity.subtype.electrical — попадание E(El) не наносит вообще ничего", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, capabilityKeys: ["damageImmunity.subtype.electrical"] });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "energy", damageSubtype: "electrical" }));
    expect(actor.system.wounds.value).toBe(20);
    expect(actor.updates).toHaveLength(0);
  });

  it("damageImmunity.subtype.electrical не гасит другой подвид того же широкого типа (laser)", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, capabilityKeys: ["damageImmunity.subtype.electrical"] });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "energy", damageSubtype: "laser" }));
    expect(actor.system.wounds.value).toBe(5);
  });

  it("damageImmunity.subtype.toxic — попадание C(Tx) не наносит вообще ничего", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, capabilityKeys: ["damageImmunity.subtype.toxic"] });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "chemical", damageSubtype: "toxic" }));
    expect(actor.system.wounds.value).toBe(20);
  });
});
