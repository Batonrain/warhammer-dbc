// test/combat/wrench-ignore-armour.test.mjs
//
// wdbc-tj0p (продолжение): "Заломить" (стр. 12, Борьба) наносит урон,
// "игнорирующий броню" — applyDamageToActor получил новый флаг
// ignoreArmour (module/combat/damage.mjs), обнуляющий AP брони локации
// целиком (свойства брони/Руны/Копьё сюда не примешиваются — им нечего
// модифицировать), но НЕ Бонус Стойкости (T.b поглощает как обычно, как и
// у обычного Пробития — см. test/combat/incoming-damage-reduction.test.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Подставной Персонаж: минимум полей, которые читает applyDamageToActor. */
function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 10 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", updates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds }
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
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Заломить", weaponName: "Заломить", ...over
});

beforeEach(resetCaptured);

describe("applyDamageToActor: ignoreArmour (Заломить)", () => {
  it("без ignoreArmour — AP брони поглощает как обычно (базовая линия)", async () => {
    const actor = characterActor({ armorAP: 8, toughnessBonus: 0, wounds: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 10 }));
    // Поглощение = 8 AP → непоглощённый 2 → Раны 10-2=8.
    expect(actor.system.wounds.value).toBe(8);
  });

  it("ignoreArmour:true — AP брони не считается вовсе, весь урон проходит", async () => {
    const actor = characterActor({ armorAP: 8, toughnessBonus: 0, wounds: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, ignoreArmour: true }));
    // AP игнорируется → поглощение 0 → Раны 10-10=0.
    expect(actor.system.wounds.value).toBe(0);
  });

  it("ignoreArmour:true — Бонус Стойкости всё равно поглощает", async () => {
    const actor = characterActor({ armorAP: 8, toughnessBonus: 3, wounds: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, ignoreArmour: true }));
    // AP игнорируется, но T.b 3 всё равно поглощает → непоглощённый 7 → Раны 10-7=3.
    expect(actor.system.wounds.value).toBe(3);
  });

  it("ignoreArmour:true — Pen не имеет значения, AP и так уже 0", async () => {
    const actor = characterActor({ armorAP: 8, toughnessBonus: 0, wounds: 10 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, ignoreArmour: true, penetration: 99 }));
    expect(actor.system.wounds.value).toBe(0);
  });
});
