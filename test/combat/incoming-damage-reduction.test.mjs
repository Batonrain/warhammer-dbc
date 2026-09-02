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
function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 10, incomingDamageReduction = 0, tier = "light", wpBonus = 0, agBonus = 0, items = [], flags = {} } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", updates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds, tier },
      characteristics: { wp: { bonus: wpBonus }, ag: { bonus: agBonus } },
      incomingDamageReduction
    },
    items: Object.assign([...items], { contents: [...items] }),
    getFlag: (scope, key) => flags[`${scope}.${key}`],
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

// Determination To Fight / Решительность Сражаться (wdbc-niv7): при
// отрицательных Ранах (Тир "dying") доп. снижение урона WP.b (минимум 1) —
// складывается с прочими источниками incomingDamageReduction в той же точке.
const determination = () => ({ type: "talent", name: "Determination To Fight / Решительность Сражаться", system: {} });

describe("Determination To Fight: доп. снижение при отрицательных Ранах (wdbc-niv7)", () => {
  it("Талант + Тир «dying» — доп. снижение WP.b складывается с прочими источниками", async () => {
    const actor = characterActor({ wounds: 10, tier: "dying", wpBonus: 4, incomingDamageReduction: 2, items: [determination()] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    // Снижение = 2 (прочее) + 4 (WP.b) = 6; непоглощённый 15−6=9.
    expect(actor.system.wounds.value).toBe(1);
    expect(captured.chat.at(-1).content).toContain("−6");
  });

  it("Талант, минимум 1 при WP.b=0", async () => {
    const actor = characterActor({ wounds: 15, tier: "dying", wpBonus: 0, items: [determination()] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(1); // 15 − 1(минимум) = 14 непоглощённого, 15−14
  });

  it("Талант, но Тир не «dying» — доп. снижения нет", async () => {
    const actor = characterActor({ wounds: 10, tier: "heavy", wpBonus: 4, items: [determination()] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(0);
  });

  it("Тир «dying», но нет Таланта — доп. снижения нет", async () => {
    const actor = characterActor({ wounds: 10, tier: "dying", wpBonus: 4 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(0);
  });
});

// Just the Light / Лишь Свет (wdbc-1rno): пока активен флаг justTheLightActive
// (выставляется processJustTheLightTurnEnd в конце Хода, снимается на старте
// следующего Хода актора) — доп. снижение A.b×3, складывается с прочими
// источниками в той же точке incomingDamageReduction.
describe("Just the Light: щит A.b×3 пока активен флаг (wdbc-1rno)", () => {
  it("флаг активен — доп. снижение A.b×3 складывается с прочими источниками", async () => {
    const actor = characterActor({
      wounds: 10, agBonus: 3, incomingDamageReduction: 2,
      flags: { "warhammer-dbc.justTheLightActive": true }
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    // Снижение = 2 (прочее) + 9 (A.b×3) = 11; непоглощённый 15−11=4; Раны 10−4=6.
    expect(actor.system.wounds.value).toBe(6);
    expect(captured.chat.at(-1).content).toContain("−11");
  });

  it("флаг не активен — доп. снижения нет", async () => {
    const actor = characterActor({ wounds: 10, agBonus: 3 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(0);
  });
});
