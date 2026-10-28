// test/combat/rolling-with-punches.test.mjs
//
// Rolling With Punches / Скользить за Ударами (Пугилист, стр. 62; Sahara
// 3-eddb): «Он увеличивает свое поглощение против безоружных атак на +½A.b,
// если он не Оглушен, Беспомощен, или атака не Незрима.»
// Округление книга не называет — вверх (▲).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { rollingWithPunchesBonus } from "../../module/rules/pugilist-talents.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const RWP = talent("Rolling With Punches / Скользить за Ударами");

function victim({ agb = 4, items = [RWP], conditions = {} } = {}) {
  const updates = [];
  return {
    id: "v1", name: "Скользящий", type: "character", uuid: "Actor.v1", updates,
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { t: { bonus: 0, total: 0 }, ag: { bonus: agb, total: agb * 10 }, wp: { bonus: 3, total: 30 } },
      wounds: { value: 20, critical: 0, max: 20 },
      conditions
    },
    items: Object.assign([...items], { contents: [] }),
    getFlag: () => undefined,
    async setFlag() {}, async unsetFlag() {},
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"] !== undefined) this.system.wounds.value = data["system.wounds.value"];
    }
  };
}

const FIST_UUID = "Item.fist";
const SWORD_UUID = "Item.sword";
const docs = {
  [FIST_UUID]: { uuid: FIST_UUID, type: "weapon", getFlag: (s, k) => k === "integralAttack" ? true : undefined },
  [SWORD_UUID]: { uuid: SWORD_UUID, type: "weapon", getFlag: () => undefined }
};

const hit = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс", melee: true,
  attackerName: "Драчун", weaponName: "Кулак", weaponUuid: FIST_UUID, ...over
});

beforeEach(() => {
  resetCaptured();
  globalThis.fromUuid = async uuid => docs[uuid] ?? null;
});

describe("rollingWithPunchesBonus (чистая)", () => {
  it("½A.b вверх: A.b 4 → 2, A.b 3 → 2, A.b 1 → 1", () => {
    expect(rollingWithPunchesBonus(victim({ agb: 4 }), true)).toBe(2);
    expect(rollingWithPunchesBonus(victim({ agb: 3 }), true)).toBe(2);
    expect(rollingWithPunchesBonus(victim({ agb: 1 }), true)).toBe(1);
  });
  it("не безоружная атака, нет Таланта, Оглушён/Беспомощен — 0", () => {
    expect(rollingWithPunchesBonus(victim(), false)).toBe(0);
    expect(rollingWithPunchesBonus(victim({ items: [] }), true)).toBe(0);
    expect(rollingWithPunchesBonus(victim({ conditions: { stunned: true } }), true)).toBe(0);
    expect(rollingWithPunchesBonus(victim({ conditions: { helpless: true } }), true)).toBe(0);
  });
});

describe("applyDamageToActor: поглощение +½A.b против безоружной атаки", () => {
  it("кулак: 10 урона − 2 = 8 Ран, подпись в карточке", async () => {
    const a = victim();
    await applyDamageToActor(a, hit());
    expect(a.system.wounds.value).toBe(12);
    expect(captured.chat.at(-1).content).toContain("Скользить за Ударами");
  });

  it("меч: бонуса нет, 10 Ран", async () => {
    const a = victim();
    await applyDamageToActor(a, hit({ weaponUuid: SWORD_UUID }));
    expect(a.system.wounds.value).toBe(10);
  });

  it("без Таланта: 10 Ран", async () => {
    const a = victim({ items: [] });
    await applyDamageToActor(a, hit());
    expect(a.system.wounds.value).toBe(10);
  });

  it("Оглушён: бонуса нет", async () => {
    const a = victim({ conditions: { stunned: true } });
    await applyDamageToActor(a, hit());
    expect(a.system.wounds.value).toBe(10);
  });

  it("стрелковая атака (melee:false) кулаком не бывает — бонуса нет", async () => {
    const a = victim();
    await applyDamageToActor(a, hit({ melee: false }));
    expect(a.system.wounds.value).toBe(10);
  });
});
