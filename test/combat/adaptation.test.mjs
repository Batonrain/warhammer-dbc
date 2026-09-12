// test/combat/adaptation.test.mjs
//
// Панцирь, субмутация 10 «Адаптация» (wdbc-q0q8): непоглощённый урон
// отмечает вид урона этой атаки и даёт +1 к Поглощению именно этого вида до
// конца боя, до потолка Cor.b — каждый вид со своим отдельным потолком.
// Проверяется отдельно: чистая логика накопления (без Foundry) и сквозной
// сценарий через applyDamageToActor (со стендовым актором).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { adaptationBonuses, maybeGrantAdaptationBonus, clearAdaptationBonuses, ADAPTATION_CAPABILITY }
  from "../../module/combat/adaptation.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function flagActor({ corruptionBonus = 3 } = {}) {
  const flags = {};
  return {
    system: { corruptionBonus },
    getFlag: (_scope, key) => flags[key],
    setFlag: async (_scope, key, value) => { flags[key] = value; },
    unsetFlag: async (_scope, key) => { delete flags[key]; }
  };
}

describe("maybeGrantAdaptationBonus / adaptationBonuses — чистая логика", () => {
  it("без Возможности — попадание ничего не накапливает", async () => {
    const actor = flagActor();
    await maybeGrantAdaptationBonus(actor, false, "impact", "");
    expect(adaptationBonuses(actor)).toEqual({});
  });

  it("подвид есть — ключ по подвиду, не по широкому типу", async () => {
    const actor = flagActor();
    await maybeGrantAdaptationBonus(actor, true, "energy", "laser");
    expect(adaptationBonuses(actor)).toEqual({ "vsSubtype:laser": 1 });
  });

  it("подвида нет — ключ по широкому типу", async () => {
    const actor = flagActor();
    await maybeGrantAdaptationBonus(actor, true, "rending", "");
    expect(adaptationBonuses(actor)).toEqual({ "vsType:rending": 1 });
  });

  it("несколько попаданий одного вида — накапливаются", async () => {
    const actor = flagActor({ corruptionBonus: 5 });
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    expect(adaptationBonuses(actor)).toEqual({ "vsType:impact": 3 });
  });

  it("потолок Cor.b — не растёт выше, но и не падает при попытке", async () => {
    const actor = flagActor({ corruptionBonus: 2 });
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    expect(adaptationBonuses(actor)).toEqual({ "vsType:impact": 2 });
  });

  it("Cor.b === 0 — потолок нулевой, ничего не накапливается", async () => {
    const actor = flagActor({ corruptionBonus: 0 });
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    expect(adaptationBonuses(actor)).toEqual({});
  });

  it("разные виды урона копятся независимо, каждый до своего потолка", async () => {
    const actor = flagActor({ corruptionBonus: 1 });
    await maybeGrantAdaptationBonus(actor, true, "impact", "");
    await maybeGrantAdaptationBonus(actor, true, "energy", "laser");
    await maybeGrantAdaptationBonus(actor, true, "impact", ""); // уже на потолке 1 — не растёт
    expect(adaptationBonuses(actor)).toEqual({ "vsType:impact": 1, "vsSubtype:laser": 1 });
  });
});

describe("clearAdaptationBonuses — конец боя снимает накопленное со всех комбатантов", () => {
  it("снимает флаг у отмеченных, не трогает тех, у кого его не было", async () => {
    const marked = flagActor();
    await maybeGrantAdaptationBonus(marked, true, "impact", "");
    const clean = flagActor();
    const combat = { combatants: [{ actor: marked }, { actor: clean }] };

    await clearAdaptationBonuses(combat);

    expect(adaptationBonuses(marked)).toEqual({});
  });

  it("без боя/комбатантов не падает", async () => {
    await expect(clearAdaptationBonuses(null)).resolves.toBeUndefined();
    await expect(clearAdaptationBonuses({ combatants: [] })).resolves.toBeUndefined();
  });
});

// ── Сквозной сценарий через applyDamageToActor ──────────────────────────────

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, corruptionBonus = 3, capabilityKeys = [] } = {}) {
  const flags = {};
  const items = capabilityKeys.map((key, i) => ({
    id: `adapt-item-${i}`, name: "Панцирь", type: "mutation",
    system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  const updates = [];
  return {
    id: "char1", name: "Приспособленец", type: "character", uuid: "Actor.char1", updates,
    system: {
      corruptionBonus,
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
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

describe("Адаптация через applyDamageToActor (wdbc-q0q8)", () => {
  it("непоглощённое попадание накапливает бонус ровно по своему виду урона", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, capabilityKeys: [ADAPTATION_CAPABILITY] });
    await applyDamageToActor(actor, damage({ rawDamage: 10, damageType: "impact", damageSubtype: "" }));
    expect(actor.getFlag("warhammer-dbc", "adaptationAbsorption")).toEqual({ "vsType:impact": 1 });
  });

  it("полностью поглощённое попадание (netDamage=0) — бонус не капает", async () => {
    const actor = characterActor({ armorAP: 20, wounds: 20, capabilityKeys: [ADAPTATION_CAPABILITY] });
    await applyDamageToActor(actor, damage({ rawDamage: 5, damageType: "impact" }));
    expect(actor.getFlag("warhammer-dbc", "adaptationAbsorption")).toBeUndefined();
  });

  it("без Возможности — попадание ничего не копит", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, damageType: "impact" }));
    expect(actor.getFlag("warhammer-dbc", "adaptationAbsorption")).toBeUndefined();
  });

  it("накопленный бонус реально снижает урон следующего такого же попадания", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, corruptionBonus: 5, capabilityKeys: [ADAPTATION_CAPABILITY] });
    await applyDamageToActor(actor, damage({ rawDamage: 10, damageType: "impact" }));
    expect(actor.system.wounds.value).toBe(10); // 10 непоглощённых, AP=0 → +1 к vsType.impact встал

    await applyDamageToActor(actor, damage({ rawDamage: 10, damageType: "impact" }));
    // Второй такой же удар: AP(0) + vsTypeBonus(1) = 1 поглощён → 9 непоглощённых.
    expect(actor.system.wounds.value).toBe(1);
  });
});
