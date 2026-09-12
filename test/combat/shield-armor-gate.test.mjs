// test/combat/shield-armor-gate.test.mjs
//
// Морозное Сердце (wdbc-giae): Конструктор kind:"shieldArmorGate" на предмете
// type:"forcefield", читается напрямую combat/damage.mjs::_rollActiveShield
// (helper _hasShieldArmorGate) — как shieldSubtype/shieldVsCondition, без
// синтетического ActiveEffect на акторе. Книга (стр. 220): «должен быть
// установлен жёсткий нагрудник и даёт щит только на участках тела, закрытых
// бронёй»:
//   - попадание в локацию БЕЗ надетой брони (любой) — щит вообще не
//     рассматривается для этого удара (урон проходит, даже если рейтинг щита
//     гарантированно заблокировал бы обычное попадание) — через
//     system.absorption.wornOnly;
//   - торс БЕЗ надетой брони СО СВОЙСТВОМ Hard/«Жёсткая» (wdbc-yday,
//     _hasHardArmorAtBody, читает system.properties брони на Торсе) —
//     «нагрудник не установлен», щит обесточен целиком, даже если сама
//     локация попадания бронирована И даже если на торсе надета
//     Мягкая/Soft броня — она не считается «жёстким нагрудником».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const armorGateMechanics = [{
  id: "g1", operator: "AND",
  entries: [{ id: "e1", kind: "shieldArmorGate" }]
}];

function shieldItem({ currentRating = 25, mechanics = armorGateMechanics } = {}) {
  return {
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active", currentRating, overloadThreshold: 0,
      shieldType: "deflector", shieldNature: "warp",
      overloadDamageFormula: "", overloadFatigueFormula: "", overloadRepairTest: ""
    },
    flags: { "warhammer-dbc": { mechanics } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    async update(data) {
      if (data["system.status"]        !== undefined) this.system.status        = data["system.status"];
      if (data["system.equipped"]      !== undefined) this.system.equipped      = data["system.equipped"];
      if (data["system.currentRating"] !== undefined) this.system.currentRating = data["system.currentRating"];
    }
  };
}

/** Броня на Торсе (wdbc-yday) — свойство "hard"/"soft" через system.properties,
 * как читает _hasHardArmorAtBody (combat/damage.mjs) и _conflictingHardArmor
 * (sheets/tabs/gear.mjs). */
function bodyArmorItem({ id = "bodyArmor1", hard = false, soft = false } = {}) {
  const properties = [];
  if (hard) properties.push("hard");
  if (soft) properties.push("soft");
  return { id, type: "armor", system: { equipped: true, body: 4, properties } };
}

function characterActor(shield, wornOnly = {}, armorItems = []) {
  const items = [shield, ...armorItems];
  return {
    id: "char1", name: "Носитель щита", type: "character",
    system: {
      absorption: {
        body: 0, toughnessBonus: 0, propFlags: {},
        wornOnly: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0, ...wornOnly }
      },
      characteristics: { wp: { bonus: 20 } },
      fatigue: { value: 0, max: 10 },
      wounds: { value: 20, critical: 0, max: 20 }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
      if (data["system.fatigue.value"]   !== undefined) this.system.fatigue.value   = data["system.fatigue.value"];
    },
    // Пробитие брони (breachArmorAtLocation, armor-properties.mjs) — вызывается,
    // когда попадание пробивает суммарный AP локации с надетой бронёй; здесь
    // достаточно no-op, тест не проверяет состояние "breached".
    async updateEmbeddedDocuments(embeddedName, updates) {
      if (embeddedName !== "Item") return [];
      for (const u of updates) {
        const it = this.items.contents.find(i => i.id === u._id);
        if (it && u["system.breached"] !== undefined) it.system.breached = u["system.breached"];
      }
      return updates;
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Враг", weaponName: "Оружие", ...over
});

beforeEach(resetCaptured);

describe("kind:\"shieldArmorGate\" — Морозное Сердце", () => {
  it("попадание в бронированную локацию (и надет Жёсткий нагрудник) — щит рассматривается и блокирует как обычно", async () => {
    const actor = characterActor(shieldItem(), { body: 4 }, [bodyArmorItem({ hard: true })]);
    captured.dice = [1]; // 1 ≤ 25 — блокировал бы
    await applyDamageToActor(actor, damage({ hitLocation: "Торс" }));

    expect(captured.rolls.length).toBe(1); // щит катился
    expect(actor.system.wounds.value).toBe(20); // аннулировано
  });

  it("попадание в локацию БЕЗ надетой брони — щит не рассматривается вовсе, урон проходит даже при гарантированном блоке", async () => {
    // Торс бронирован Жёсткой бронёй (нагрудник установлен), но попадание
    // пришло в незащищённую Руку — сама эта локация «не закрыта бронёй».
    const actor = characterActor(shieldItem(), { body: 4, rightArm: 0 }, [bodyArmorItem({ hard: true })]);
    captured.dice = [1]; // 1 ≤ 25 — блокировал бы, если бы щит катился
    await applyDamageToActor(actor, damage({ hitLocation: "Рука" }));

    expect(captured.rolls.length).toBe(0); // щит вообще не катился
    expect(actor.system.wounds.value).toBeLessThan(20);
  });

  it("торс БЕЗ надетой брони вовсе (нагрудник не установлен) — щит обесточен целиком, даже по бронированной локации попадания", async () => {
    const actor = characterActor(shieldItem(), { body: 0, head: 4 });
    captured.dice = [1];
    await applyDamageToActor(actor, damage({ hitLocation: "Голова" }));

    expect(captured.rolls.length).toBe(0);
    expect(actor.system.wounds.value).toBeLessThan(20);
  });

  it("wdbc-yday: торс закрыт Мягкой (Soft), а не Жёсткой бронёй — не считается «жёстким нагрудником», щит обесточен, даже когда локация формально прикрыта", async () => {
    const actor = characterActor(shieldItem(), { body: 4 }, [bodyArmorItem({ soft: true })]);
    captured.dice = [1]; // 1 ≤ 25 — блокировал бы, если бы щит катился
    await applyDamageToActor(actor, damage({ hitLocation: "Торс" }));

    expect(captured.rolls.length).toBe(0); // щит вообще не катился
    expect(actor.system.wounds.value).toBeLessThan(20);
  });

  it("без записи kind:\"shieldArmorGate\" — обычный щит по-прежнему не смотрит на локации/жёсткость", async () => {
    const actor = characterActor(shieldItem({ mechanics: [] }), { body: 0, rightArm: 0 });
    captured.dice = [1];
    await applyDamageToActor(actor, damage({ hitLocation: "Рука" }));

    expect(captured.rolls.length).toBe(1);
    expect(actor.system.wounds.value).toBe(20);
  });
});
