// test/combat/mercury-reaction.test.mjs
//
// Замена Крови, субмутация 2 «Ртуть» (wdbc-q0q8): непоглощённый I/R/X урон
// отмечает раненую часть тела — иммунна к E(Ls), но проводит ток (noEnergy)
// до конца боя. Проверяется отдельно: чистая логика меток (без Foundry) и
// сквозной сценарий через applyDamageToActor (со стендовым актором).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { isMercuryElectrified, maybeMarkMercuryLocation, clearMercuryMarks }
  from "../../module/combat/mercury-reaction.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Подставной актор с рабочим хранилищем флагов (get/set/unset). */
function flagActor() {
  const flags = {};
  return {
    getFlag: (_scope, key) => flags[key],
    setFlag: async (_scope, key, value) => { flags[key] = value; },
    unsetFlag: async (_scope, key) => { delete flags[key]; }
  };
}

describe("isMercuryElectrified / maybeMarkMercuryLocation — чистая логика", () => {
  it("без метки — не электропроводна", () => {
    expect(isMercuryElectrified(flagActor(), "body")).toBe(false);
  });

  it("без Возможности (hasReactionFlag=false) — попадание не отмечает локацию", async () => {
    const actor = flagActor();
    await maybeMarkMercuryLocation(actor, false, "impact", "body");
    expect(isMercuryElectrified(actor, "body")).toBe(false);
  });

  it("с Возможностью и подходящим типом (impact) — локация отмечается", async () => {
    const actor = flagActor();
    await maybeMarkMercuryLocation(actor, true, "impact", "body");
    expect(isMercuryElectrified(actor, "body")).toBe(true);
    expect(isMercuryElectrified(actor, "head")).toBe(false);
  });

  it("подвид/тип вне I/R/X (energy, chemical) — не отмечает", async () => {
    const actor = flagActor();
    await maybeMarkMercuryLocation(actor, true, "energy", "body");
    await maybeMarkMercuryLocation(actor, true, "chemical", "body");
    expect(isMercuryElectrified(actor, "body")).toBe(false);
  });

  it("rending и blast (X) тоже отмечают — книга: «I, R или X»", async () => {
    const actor = flagActor();
    await maybeMarkMercuryLocation(actor, true, "rending", "leftArm");
    await maybeMarkMercuryLocation(actor, true, "blast", "rightLeg");
    expect(isMercuryElectrified(actor, "leftArm")).toBe(true);
    expect(isMercuryElectrified(actor, "rightLeg")).toBe(true);
  });

  it("несколько локаций накапливаются, не перетирают друг друга", async () => {
    const actor = flagActor();
    await maybeMarkMercuryLocation(actor, true, "impact", "body");
    await maybeMarkMercuryLocation(actor, true, "impact", "head");
    expect(isMercuryElectrified(actor, "body")).toBe(true);
    expect(isMercuryElectrified(actor, "head")).toBe(true);
  });
});

describe("clearMercuryMarks — конец боя снимает метки со всех комбатантов", () => {
  it("снимает флаг у отмеченных, не трогает тех, у кого его не было", async () => {
    const marked = flagActor();
    await maybeMarkMercuryLocation(marked, true, "impact", "body");
    const clean = flagActor();
    const combat = { combatants: [{ actor: marked }, { actor: clean }] };

    await clearMercuryMarks(combat);

    expect(isMercuryElectrified(marked, "body")).toBe(false);
  });

  it("без боя/комбатантов не падает", async () => {
    await expect(clearMercuryMarks(null)).resolves.toBeUndefined();
    await expect(clearMercuryMarks({ combatants: [] })).resolves.toBeUndefined();
  });
});

// ── Сквозной сценарий через applyDamageToActor ──────────────────────────────

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, capabilityKeys = [] } = {}) {
  const flags = {};
  const items = capabilityKeys.map((key, i) => ({
    id: `mercury-item-${i}`, name: "Замена Крови", type: "mutation",
    system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  const updates = [];
  return {
    id: "char1", name: "Ртутный", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: {
        head: armorAP + toughnessBonus, body: armorAP + toughnessBonus,
        toughnessBonus, propFlags: {}
      },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([...items], { contents: items }),
    getFlag: (scope, key) => (scope === "warhammer-dbc" ? flags[key] : undefined),
    setFlag: async (scope, key, value) => { if (scope === "warhammer-dbc") flags[key] = value; },
    unsetFlag: async (scope, key) => { if (scope === "warhammer-dbc") delete flags[key]; },
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(resetCaptured);

describe("Ртуть через applyDamageToActor (wdbc-q0q8)", () => {
  it("первое (непоглощённое I) попадание отмечает локацию — второе, лазерное, в ту же локацию не наносит ничего", async () => {
    const actor = characterActor({
      armorAP: 0, wounds: 20, capabilityKeys: ["mutation.bloodReplacement.mercuryReaction"]
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "impact", hitLocation: "Торс" }));
    expect(actor.system.wounds.value).toBe(5);

    await applyDamageToActor(actor, damage({
      rawDamage: 15, damageType: "energy", damageSubtype: "laser", hitLocation: "Торс"
    }));
    expect(actor.system.wounds.value).toBe(5); // не изменилось — попадание проигнорировано
  });

  it("лазер в ДРУГУЮ (не отмеченную) локацию наносит урон как обычно", async () => {
    const actor = characterActor({
      armorAP: 0, wounds: 20, capabilityKeys: ["mutation.bloodReplacement.mercuryReaction"]
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "impact", hitLocation: "Торс" }));
    await applyDamageToActor(actor, damage({
      rawDamage: 15, damageType: "energy", damageSubtype: "laser", hitLocation: "Голова"
    }));
    expect(actor.system.wounds.value).toBe(0);
  });

  it("без Возможности — попадание I не отмечает локацию, следующий лазер бьёт как обычно", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, damageType: "impact", hitLocation: "Торс" }));
    await applyDamageToActor(actor, damage({
      rawDamage: 15, damageType: "energy", damageSubtype: "laser", hitLocation: "Торс"
    }));
    expect(actor.system.wounds.value).toBe(0);
  });

  it("отмеченная локация проводит ток: следующий Энергетический удар той же локации теряет AP от брони", async () => {
    // Первый удар (10 > AP 6) непоглощён частично — ставит метку. Второй,
    // Энергетический — без метки AP=6 поглотил бы весь урон; с меткой (noEnergy) AP=0.
    const actor = characterActor({
      armorAP: 6, wounds: 20, capabilityKeys: ["mutation.bloodReplacement.mercuryReaction"]
    });
    await applyDamageToActor(actor, damage({ rawDamage: 10, damageType: "impact", hitLocation: "Торс" }));
    expect(actor.system.wounds.value).toBe(16); // 10 − AP 6 = 4 непоглощённых

    await applyDamageToActor(actor, damage({
      rawDamage: 10, damageType: "energy", damageSubtype: "electrical", hitLocation: "Торс"
    }));
    // AP обнулён (noEnergy) — весь удар проходит непоглощённым.
    expect(actor.system.wounds.value).toBe(6);
  });

  it("попадание поглощено полностью (netDamage=0) — метка не ставится", async () => {
    const actor = characterActor({
      armorAP: 20, wounds: 20, capabilityKeys: ["mutation.bloodReplacement.mercuryReaction"]
    });
    await applyDamageToActor(actor, damage({ rawDamage: 1, damageType: "impact", hitLocation: "Торс" }));
    expect(actor.system.wounds.value).toBe(20);

    await applyDamageToActor(actor, damage({
      rawDamage: 15, damageType: "energy", damageSubtype: "laser", hitLocation: "Торс"
    }));
    // Метки нет — лазер бьёт как обычно, поглощается той же большой бронёй.
    expect(actor.system.wounds.value).toBe(20);
  });
});
