// test/combat/saw-ignores-dome-shield.test.mjs
//
// Приём Пила (стр. 14, wdbc-x1nz.2.66.2): «Эта атака игнорирует силовые
// щиты-купола» — только shieldType "dome" (умолчание), не Дефлекторный/
// Сквозной. Проверяется на уровне applyDamageToActor(damageData.
// ignoreDomeShields), тем же приёмом, что shield-armor-gate.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function shieldItem({ shieldType = "dome", currentRating = 25 } = {}) {
  return {
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active", currentRating, overloadThreshold: 0,
      shieldType, shieldNature: "technological",
      overloadDamageFormula: "", overloadFatigueFormula: "", overloadRepairTest: ""
    },
    getFlag() { return undefined; },
    async update(data) {
      if (data["system.status"]        !== undefined) this.system.status        = data["system.status"];
      if (data["system.currentRating"] !== undefined) this.system.currentRating = data["system.currentRating"];
    }
  };
}

function characterActor(shield) {
  const items = [shield];
  return {
    id: "char1", name: "Носитель щита", type: "character",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {}, wornOnly: {} },
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
    async updateEmbeddedDocuments() { return []; }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Враг", weaponName: "Пила", melee: true, ...over
});

beforeEach(resetCaptured);

describe("Пила игнорирует силовые щиты-купола (стр. 14)", () => {
  it("щит-купол (shieldType по умолчанию) — не рассматривается вовсе, урон проходит даже при гарантированном блоке", async () => {
    const actor = characterActor(shieldItem({ shieldType: "dome" }));
    captured.dice = [1]; // 1 ≤ 25 — блокировал бы, если бы щит катился
    await applyDamageToActor(actor, damage({ ignoreDomeShields: true }));

    expect(captured.rolls.length).toBe(0); // щит вообще не катился
    expect(actor.system.wounds.value).toBeLessThan(20);
  });

  it("Дефлекторный щит — Пила его НЕ игнорирует, блокирует как обычно", async () => {
    const actor = characterActor(shieldItem({ shieldType: "deflector" }));
    captured.dice = [1];
    await applyDamageToActor(actor, damage({ ignoreDomeShields: true }));

    expect(captured.rolls.length).toBe(1); // щит катился
    expect(actor.system.wounds.value).toBe(20); // аннулировано
  });

  it("обычная атака (ignoreDomeShields не передан) — щит-купол блокирует как обычно", async () => {
    const actor = characterActor(shieldItem({ shieldType: "dome" }));
    captured.dice = [1];
    await applyDamageToActor(actor, damage());

    expect(captured.rolls.length).toBe(1);
    expect(actor.system.wounds.value).toBe(20);
  });
});
