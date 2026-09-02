// test/combat/recoil-cover-bonus.test.mjs
//
// «Отскок в Укрытие» (wdbc-9wvm, стр. 12): performRecoil ставит разовый флаг
// flags.warhammer-dbc.recoilCoverBonus на защищающемся — applyDamageToActor
// должен прочитать и потратить его РОВНО один раз на ближайшее попадание,
// тем же местом расчёта, что и Защитные Руны (runesBonus).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, coverBonus = 0 } = {}) {
  const flags = {};
  if (coverBonus) flags["warhammer-dbc.recoilCoverBonus"] = coverBonus;
  const actor = {
    id: "char1", name: "Отскочивший", type: "character",
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; },
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) actor.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) actor.system.wounds.critical = data["system.wounds.critical"];
    }
  };
  return actor;
}

const damage = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("recoilCoverBonus: разовая +AP от Отскока в Укрытие", () => {
  it("без флага — обычное поглощение, без заметки об Укрытии", async () => {
    const actor = characterActor({ armorAP: 2, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10 }));
    expect(actor.system.wounds.value).toBe(12); // 10 − 2 AP
    expect(captured.chat.at(-1).content).not.toContain("Отскок в Укрытие");
  });

  it("с флагом — AP прибавляется к поглощению этого попадания", async () => {
    const actor = characterActor({ armorAP: 2, wounds: 20, coverBonus: 6 });
    await applyDamageToActor(actor, damage({ rawDamage: 10 }));
    // Поглощение 2 (броня) + 6 (Укрытие) = 8; непоглощённый 10−8=2.
    expect(actor.system.wounds.value).toBe(18);
    expect(captured.chat.at(-1).content).toContain("Отскок в Укрытие: +6 AP");
  });

  it("флаг тратится ровно один раз — второе попадание его уже не видит", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 30, coverBonus: 6 });
    await applyDamageToActor(actor, damage({ rawDamage: 8 }));
    expect(actor.system.wounds.value).toBe(28); // 8 − 6, первое попадание съело бонус
    await applyDamageToActor(actor, damage({ rawDamage: 8 }));
    expect(actor.system.wounds.value).toBe(20); // 8 − 0, бонус уже потрачен
  });
});
