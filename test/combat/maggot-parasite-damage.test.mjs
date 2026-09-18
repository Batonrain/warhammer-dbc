// test/combat/maggot-parasite-damage.test.mjs
//
// Maggot Parasite/Опарыш-Паразит (wdbc-ux8a): интеграция в combat/
// damage.mjs::applyDamageToActor — кнопка «Констатировать смерть» заменяется
// «Опарыш выскакивает», когда крит-эффект утверждает смерть и ЖЕРТВА (не
// атакующий, в отличие от Volunteer Actor) несёт этот Дар.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../critical-tables.mjs", () => ({
  getCriticalEffect: () => "Голова цели взрывается — цель умирает мгновенно."
}));

import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor(capabilityKeys = []) {
  const items = capabilityKeys.map((key, i) => ({
    id: `mp-item-${i}`, name: "Maggot Parasite / Опарыш-Паразит", type: "mutation", system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  const flags = {};
  return {
    id: "char1", name: "Опарыш", type: "character", uuid: "Actor.victim",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      wounds: { value: 0, critical: 25, max: 20 }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) { if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"]; },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

const damage = (over = {}) => ({
  rawDamage: 50, penetration: 0, damageType: "impact", hitLocation: "Голова",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(() => { resetCaptured(); game.time = { worldTime: 1000 }; globalThis.fromUuid = async () => null; });

describe("Maggot Parasite: замена кнопки «Констатировать смерть» на «Опарыш выскакивает»", () => {
  it("жертва несёт Дар — кнопка Опарыша, не смерти", async () => {
    const actor = characterActor(["gift.nurgle.maggotParasite"]);
    await applyDamageToActor(actor, damage());
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-parasite-begin-contact-btn");
    expect(card).not.toContain("wh-crit-death-btn");
  });

  it("без Дара — обычная кнопка смерти", async () => {
    const actor = characterActor([]);
    await applyDamageToActor(actor, damage());
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-parasite-begin-contact-btn");
    expect(card).toContain("wh-crit-death-btn");
  });

  it("варп-оружие (warpSoak) — обычная кнопка смерти, даже с Даром", async () => {
    const actor = characterActor(["gift.nurgle.maggotParasite"]);
    await applyDamageToActor(actor, damage({ warpSoak: true }));
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-parasite-begin-contact-btn");
    expect(card).toContain("wh-crit-death-btn");
  });
});
