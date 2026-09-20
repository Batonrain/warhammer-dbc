// test/combat/damage-extreme-floor.test.mjs
//
// Стр. 34, wdbc-x1nz.2.50: «[Экстремальный Урон] не наносит урона в Раны
// цели... Тем не менее, если после Поглощения попадание не нанесло никакого
// реального урона, оно наносит 1 непоглощаемого урона.» hasExtreme едет в
// damageData с кнопки применения урона (attack-card.mjs::data-has-extreme,
// прочитано hooks.mjs) — здесь проверяется сам applyDamageToActor/
// applyDamageToVehicle, минуя карточку.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", uuid: "Actor.char1", updates,
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

function vehicleActor({ armorSide = 0 } = {}) {
  const updates = [];
  return {
    id: "veh1", name: "Кентавр", type: "vehicle", uuid: "Actor.veh1", updates,
    system: {
      armour: { side: armorSide, front: armorSide, rear: armorSide },
      structure: { value: 10, critical: 0, max: 10 },
      voidShields: [], derived: {}
    },
    getActiveTokens: () => [],
    async update(data) {
      updates.push(data);
      if (data["system.structure.value"]    !== undefined) this.system.structure.value    = data["system.structure.value"];
      if (data["system.structure.critical"] !== undefined) this.system.structure.critical = data["system.structure.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(resetCaptured);

describe("Экстремальный Урон: 1 непоглощаемого урона при нулевом (wdbc-x1nz.2.50)", () => {
  it("существо: броня поглощает всё, hasExtreme — 1 урон всё равно проходит", async () => {
    const actor = characterActor({ armorAP: 10, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 5, hasExtreme: true }));
    expect(actor.system.wounds.value).toBe(19);
    expect(captured.chat.at(-1).content).toContain("непоглощаемого урона");
  });

  it("существо: та же броня, БЕЗ hasExtreme — урон честно 0, Раны не трогает", async () => {
    const actor = characterActor({ armorAP: 10, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 5, hasExtreme: false }));
    expect(actor.system.wounds.value).toBe(20);
    expect(captured.chat.at(-1).content).toContain("Урон поглощён полностью");
  });

  it("существо: hasExtreme, но урон и так прошёл — минимум не удваивает его", async () => {
    const actor = characterActor({ armorAP: 2, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 5, hasExtreme: true }));
    expect(actor.system.wounds.value).toBe(17); // 5 - 2 = 3, минимум тут не участвует
  });

  it("техника: броня поглощает всё, hasExtreme — 1 в Структуру всё равно проходит", async () => {
    const actor = vehicleActor({ armorSide: 10 });
    await applyDamageToActor(actor, { rawDamage: 5, penetration: 0, damageType: "impact",
      side: "side", hitLocation: "Корпус", hasExtreme: true });
    expect(actor.system.structure.value).toBe(9);
  });

  it("техника: без hasExtreme та же броня — Структура не трогается", async () => {
    const actor = vehicleActor({ armorSide: 10 });
    await applyDamageToActor(actor, { rawDamage: 5, penetration: 0, damageType: "impact",
      side: "side", hitLocation: "Корпус", hasExtreme: false });
    expect(actor.system.structure.value).toBe(10);
  });
});
