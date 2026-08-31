// test/combat/horde-single-target-immune.test.mjs
//
// wdbc-gzuf (Серый Человек): «избегает атак Орды как одиночная цель (без
// бонусных кубиков урона), теряется при Размере 2+». Цель ещё не известна на
// момент броска Орды (horde-sheet.mjs), поэтому кубы Магнитуды едут отдельным
// числом (damageData.magDiceBonus) и вычитаются здесь, в applyDamageToActor
// (module/combat/damage.mjs), где актор-цель уже точно известен.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ sizeTotal = 0, immune = false, wounds = 30 } = {}) {
  const items = immune ? [{
    id: "trait1", name: "Oteshii Physiology / Физиология Отеший", type: "trait",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "horde.singleTargetImmune", label: "" }
    ] }] } }
  }] : [];
  return {
    id: "char1", name: "Серый Человек", type: "character",
    system: {
      sizeTotal,
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { wp: { bonus: 0 } },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Орда Культистов", weaponName: "Шквал", ...over
});

beforeEach(resetCaptured);

describe("Избегание атак Орды как одиночной цели (wdbc-gzuf)", () => {
  it("без иммунитета — кубы Магнитуды бьют как обычно (контроль)", async () => {
    const actor = characterActor({ immune: false, sizeTotal: 0 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, magDiceBonus: 10 }));
    expect(actor.system.wounds.value).toBe(15); // 30 - 15
  });

  it("с иммунитетом и Размером < 2 — кубы Магнитуды вычитаются из урона", async () => {
    const actor = characterActor({ immune: true, sizeTotal: 0 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, magDiceBonus: 10 }));
    expect(actor.system.wounds.value).toBe(25); // 30 - (15 - 10)
  });

  it("вычитание не уходит в минус — при magDiceBonus больше rawDamage урон = 0", async () => {
    const actor = characterActor({ immune: true, sizeTotal: 0 });
    await applyDamageToActor(actor, damage({ rawDamage: 8, magDiceBonus: 10 }));
    expect(actor.system.wounds.value).toBe(30); // 30 - 0
  });

  it("иммунитет теряется при Размере 2+ — кубы Магнитуды снова бьют", async () => {
    const actor = characterActor({ immune: true, sizeTotal: 2 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, magDiceBonus: 10 }));
    expect(actor.system.wounds.value).toBe(15); // 30 - 15, без скидки
  });

  it("magDiceBonus 0 (обычная атака, не Орда) — иммунитет ни на что не влияет", async () => {
    const actor = characterActor({ immune: true, sizeTotal: 0 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, magDiceBonus: 0 }));
    expect(actor.system.wounds.value).toBe(15); // 30 - 15
  });
});
