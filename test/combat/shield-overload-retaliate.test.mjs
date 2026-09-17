// test/combat/shield-overload-retaliate.test.mjs
//
// Перегрузка-возмездие (Arheotech Refractor, wdbc-1rno.2): при Перегрузке
// щита (rv ≤ rating ≤ threshold) щит с заполненным overloadRetaliateFormula
// бьёт формулой в атакующего (attackerUuid), Pen = overloadRetaliatePen,
// тип energy, обычным конвейером урона (не непоглощаемым, в отличие от
// overloadDamageFormula). isRetaliation=true на входе обрывает цепь —
// повторной Перегрузки-возмездия у ответного удара не бывает.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function shieldItem({ overloadRetaliateFormula = "2d10+5", overloadRetaliatePen = 15 } = {}) {
  return {
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active", currentRating: 50, overloadThreshold: 50,
      shieldType: "dome", shieldNature: "technological",
      overloadDamageFormula: "", overloadFatigueFormula: "", overloadRepairTest: "",
      overloadRetaliateFormula, overloadRetaliatePen
    },
    flags: {},
    getFlag() { return undefined; },
    async update(data) {
      if (data["system.status"]        !== undefined) this.system.status        = data["system.status"];
      if (data["system.equipped"]      !== undefined) this.system.equipped      = data["system.equipped"];
      if (data["system.currentRating"] !== undefined) this.system.currentRating = data["system.currentRating"];
    }
  };
}

function plainActor({ id, name, shield = null, wounds = 20 } = {}) {
  const items = shield ? [shield] : [];
  return {
    id, name, uuid: `Actor.${id}`, type: "character",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {}, wornOnly: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 } },
      characteristics: { wp: { bonus: 20 } },
      fatigue: { value: 0, max: 10 },
      wounds: { value: wounds, critical: 0, max: wounds }
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
  attackerName: "Атакующий", weaponName: "Оружие", ...over
});

beforeEach(resetCaptured);

describe("Перегрузка-возмездие (overloadRetaliateFormula)", () => {
  it("Перегрузка бьёт лучом в атакующего — обычным конвейером урона (Pen учитывается)", async () => {
    const attacker = plainActor({ id: "atk1", name: "Атакующий" });
    const defender = plainActor({ id: "def1", name: "Носитель щита", shield: shieldItem() });
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : null);

    // dice: [щит d100=5, ретальный 2d10 → 3,4] = 5≤50≤50 → overloaded; 3+4+5=12 урона
    captured.dice = [5, 3, 4];
    await applyDamageToActor(defender, damage({ attackerUuid: attacker.uuid }));

    expect(defender.items[0].system.status).toBe("overloaded"); // щит выключен
    expect(attacker.system.wounds.value).toBe(20 - 12); // 12 урона прошло (Pen 15 против AP 0)
  });

  it("isRetaliation=true на входе — Перегрузка-возмездие не срабатывает повторно (обрыв цепи)", async () => {
    const attacker = plainActor({ id: "atk1", name: "Атакующий" });
    const defender = plainActor({ id: "def1", name: "Носитель щита", shield: shieldItem() });
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : null);

    captured.dice = [5]; // только щит катится — ретального удара быть не должно
    await applyDamageToActor(defender, damage({ attackerUuid: attacker.uuid, isRetaliation: true }));

    expect(defender.items[0].system.status).toBe("overloaded");
    expect(attacker.system.wounds.value).toBe(20); // не тронут
  });

  it("нет attackerUuid — Перегрузка срабатывает как обычно, без ретального удара", async () => {
    const defender = plainActor({ id: "def1", name: "Носитель щита", shield: shieldItem() });
    captured.dice = [5];
    await applyDamageToActor(defender, damage());

    expect(defender.items[0].system.status).toBe("overloaded");
    expect(captured.chat.some(c => String(c.content || "").includes("Перегрузка бьёт лучом"))).toBe(false);
  });

  it("щит без overloadRetaliateFormula (обычный щит) — Перегрузка без ретального удара", async () => {
    const attacker = plainActor({ id: "atk1", name: "Атакующий" });
    const defender = plainActor({ id: "def1", name: "Носитель щита", shield: shieldItem({ overloadRetaliateFormula: "" }) });
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : null);

    captured.dice = [5];
    await applyDamageToActor(defender, damage({ attackerUuid: attacker.uuid }));

    expect(defender.items[0].system.status).toBe("overloaded");
    expect(attacker.system.wounds.value).toBe(20);
  });
});
