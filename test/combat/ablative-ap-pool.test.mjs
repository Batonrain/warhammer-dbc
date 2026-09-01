// test/combat/ablative-ap-pool.test.mjs
//
// wdbc-bxw6: аблативный AP-щит персонажа (system.ablativeApShield, напр.
// Роба Чемпиона) и аблативные моды брони («Аблативная») — оба добавляют
// плоский AP к поглощению ЭТОГО попадания и теряют ровно 1 заряд с него,
// независимо от нанесённого урона (module/combat/damage.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function armorItem(id, overrides = {}) {
  return { id, type: "armor", system: { equipped: true, armorType: "flak", ...overrides } };
}
function modItem(id, installedOn, overrides = {}) {
  return {
    id, type: "armorMod",
    system: { installedOn, category: "armor", activatable: false, active: false,
              ablative: false, ablativeCharge: 0, effects: {}, ...overrides },
    getFlag: () => undefined
  };
}

/** Подставной Персонаж с аблативным AP-щитом и/или аблативными модами брони. */
function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, shieldValue = 0, items = [] } = {}) {
  const updates = [];
  const embeddedUpdates = [];
  const itemsList = Object.assign([...items], { contents: [...items] });
  return {
    id: "char1", name: "Варлок", type: "character", updates, embeddedUpdates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds },
      ablativeApShield: { value: shieldValue, max: shieldValue }
    },
    items: itemsList,
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
      if (data["system.ablativeApShield.value"] !== undefined) this.system.ablativeApShield.value = data["system.ablativeApShield.value"];
    },
    async updateEmbeddedDocuments(_type, changes) {
      embeddedUpdates.push(changes);
      for (const c of changes) {
        const item = itemsList.find(i => i.id === c._id);
        if (item && c["system.ablativeCharge"] !== undefined) item.system.ablativeCharge = c["system.ablativeCharge"];
      }
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("аблативный AP-щит персонажа: добавляет AP и теряет 1/попадание", () => {
  it("без щита (value 0) — поглощение как обычно, апдейт щита не шлётся", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 10, shieldValue: 0 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(0);
    expect(actor.updates.some(u => "system.ablativeApShield.value" in u)).toBe(false);
  });

  it("щит на 2 — добавляется к поглощению (15 − 2 = 13 в Раны)", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20, shieldValue: 2 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(actor.system.wounds.value).toBe(7); // 20 - 13
  });

  it("щит теряет РОВНО 1 заряд с попадания, даже при полностью поглощённом уроне", async () => {
    const actor = characterActor({ armorAP: 20, toughnessBonus: 0, wounds: 20, shieldValue: 2 });
    await applyDamageToActor(actor, damage({ rawDamage: 5 })); // AP 20 + щит 2 >> урон 5
    expect(actor.system.ablativeApShield.value).toBe(1);
  });

  it("щит не подчиняется Пробитию/Копью (отдельный слой от физической брони)", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 0, wounds: 20, shieldValue: 2 });
    // AP 10 − Pen 10 = 0 эфф. AP, но щит всё равно добавляет свои 2.
    await applyDamageToActor(actor, damage({ rawDamage: 15, penetration: 10 }));
    expect(actor.system.wounds.value).toBe(20 - (15 - 2));
  });

  it("сообщение в чат показывает остаток щита после попадания", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20, shieldValue: 2 });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Аблативный AP-щит: +2");
    expect(card).toContain("остаток после попадания: 1");
  });
});

describe("аблативный мод брони («Аблативная»): apAll добавляется и теряет 1/попадание", () => {
  it("работающий мод (заряд > 0) добавляет apAll к поглощению и теряет 1 заряд", async () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 5, effects: { apAll: 5 } });
    // Мод не участвует напрямую в absorption (это считает rules/character.mjs,
    // здесь только конвейер урона) — проверяем ровно списание заряда.
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20, items: [armor, mod] });
    await applyDamageToActor(actor, damage({ rawDamage: 5 }));
    expect(mod.system.ablativeCharge).toBe(4);
  });

  it("истощённый (0) мод не трогается update'ом", async () => {
    const armor = armorItem("a1");
    const mod = modItem("m1", "a1", { ablative: true, ablativeCharge: 0, effects: { apAll: 5 } });
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20, items: [armor, mod] });
    await applyDamageToActor(actor, damage({ rawDamage: 5 }));
    expect(actor.embeddedUpdates).toHaveLength(0);
  });
});
