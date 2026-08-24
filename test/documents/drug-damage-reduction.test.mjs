// test/documents/drug-damage-reduction.test.mjs
//
// «Снижает урон попадания» (specialEffects.reduceDamageOnHit) у препарата
// был объявлен в схеме и печатался на листе (sheet-helpers.mjs), но к
// конвейеру урона не подключался нигде. Теперь, пока основной эффект
// препарата активен, значение плюсуется к system.incomingDamageReduction
// (documents/actor.mjs, тем же приёмом, что statMods) — и combat/damage.mjs
// снижает входящий урон, как от любого другого источника этого поля.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Препарат: ровно то, что читает цикл активных препаратов в prepareDerivedData. */
function drug({ isActive = true, isAfterEffect = false, reduce = 3 } = {}) {
  return {
    id: "drug-stimm", name: "Стимм", type: "drug",
    system: {
      activeEffect: { isActive, isAfterEffect },
      specialEffects: { reduceDamageOnHit: reduce },
      statMods: {}
    },
    getFlag: () => undefined
  };
}

/** Персонаж без брони и с нулевым T.b: весь сырой урон — непоглощённый. */
function preparedCharacter(items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.wounds.value = 10;
  system.wounds.max = 10;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  const updates = [];
  return {
    id: "char1", name: "Подставной", type: "character", system, updates,
    items: Object.assign(list, { contents: list }),
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 8, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("препарат с reduceDamageOnHit подключён к конвейеру урона", () => {
  it("активный препарат с reduceDamageOnHit=3 снижает входящий урон на 3", async () => {
    const actor = preparedCharacter([drug({ reduce: 3 })]);
    expect(actor.system.incomingDamageReduction).toBe(3);

    await applyDamageToActor(actor, damage({ rawDamage: 8 }));
    // Поглощения нет: 8 − 3 = 5 в Раны.
    expect(actor.system.wounds.value).toBe(5);
  });

  it("после окончания действия снижения нет", async () => {
    const actor = preparedCharacter([drug({ reduce: 3, isActive: false })]);
    expect(actor.system.incomingDamageReduction).toBe(0);

    await applyDamageToActor(actor, damage({ rawDamage: 8 }));
    expect(actor.system.wounds.value).toBe(2);
  });

  it("пост-эффект снижения не даёт (reduceDamageOnHit — поле основного эффекта)", async () => {
    const actor = preparedCharacter([drug({ reduce: 3, isAfterEffect: true })]);
    expect(actor.system.incomingDamageReduction).toBe(0);
  });
});
