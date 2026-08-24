// test/combat/incoming-damage-reduction.test.mjs
//
// wdbc-ls9d: точка расширения для плоского снижения входящего урона —
// system.incomingDamageReduction (ХРАНИМОЕ поле, фаза "initial" — см.
// constants/effect-keys.mjs). Вычитается из непоглощённого урона ПОСЛЕ AP/T.b,
// пробитием не уменьшается. Несколько источников (эффектов) суммируются —
// это делает сам Foundry (каждый ActiveEffect с mode "add" в фазе "initial"
// плюсуется к хранимому нулю), здесь проверяется только конвейер урона.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Подставной Персонаж: минимум полей, которые читает applyDamageToActor. */
function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 10, incomingDamageReduction = 0 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", updates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds },
      incomingDamageReduction
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
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("system.incomingDamageReduction: доп. снижение входящего урона", () => {
  it("без снижения — урон идёт в Раны как обычно (перелив в Критические)", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(0);
    expect(actor.system.wounds.critical).toBe(5);
  });

  it("15 урона, поглощение 0, снижение −10 — в Раны проходит 5", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 10, incomingDamageReduction: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(5);
  });

  it("снижение не зависит от пробития — вычитается уже после AP/Pen", async () => {
    const actor = characterActor({ armorAP: 6, toughnessBonus: 4, wounds: 10, incomingDamageReduction: 3 });
    // Поглощение = 6 AP + 4 T.b = 10, пробитие 5 → эфф. AP = 1 → поглощение 5.
    // Непоглощённый = 15 − 5 = 10, минус снижение 3 = 7.
    await applyDamageToActor(actor, damage({ rawDamage: 15, penetration: 5 }));
    expect(actor.system.wounds.value).toBe(3);
  });

  it("снижение больше урона — Раны не теряются, update не шлётся", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 10, incomingDamageReduction: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(10);
    expect(actor.updates).toHaveLength(0);
  });

  it("сообщение в чат показывает строку доп. снижения", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 10, incomingDamageReduction: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Доп. снижение входящего урона");
    expect(card).toContain("−10");
  });
});
