// test/combat/volunteer-actor-damage.test.mjs
//
// Volunteer Actor/Доброволец Актёр (wdbc-ux8a): интеграция в combat/
// damage.mjs::applyDamageToActor — кнопка «Констатировать смерть» заменяется
// «Поцелуй Мимика», когда крит-эффект утверждает смерть, атакующий несёт
// Талант и бил Поцелуем Арлекина. Сам захват (Foundry-действия) — в
// test/apps/volunteer-actor.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../critical-tables.mjs", () => ({
  getCriticalEffect: () => "Голова цели взрывается — цель умирает мгновенно."
}));

import { applyDamageToActor } from "../../module/combat/damage.mjs";

/** Подставной Персонаж-жертва (та же форма, что test/combat/cast-out-of-death-damage.test.mjs). */
function characterActor() {
  const flags = {};
  return {
    id: "char1", name: "Жертва", type: "character", uuid: "Actor.victim",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      wounds: { value: 0, critical: 25, max: 20 }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) { if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"]; },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

function attackerActor(capabilityKeys = []) {
  const items = capabilityKeys.map((key, i) => ({
    id: `va-item-${i}`, name: "Volunteer Actor / Доброволец Актёр", type: "talent", system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  return { id: "attacker1", name: "Мимик", type: "character", uuid: "Actor.attacker", items };
}

function harlequinsKissItem() {
  return { id: "hk1", name: "Harlequin’s Kiss (Brathu-Angua) / Поцелуй Арлекина", type: "weapon", system: {} };
}

const damage = (over = {}) => ({
  rawDamage: 50, penetration: 0, damageType: "impact", hitLocation: "Голова",
  attackerName: "Мимик", weaponName: "Поцелуй Арлекина", ...over
});

beforeEach(() => { resetCaptured(); game.time = { worldTime: 1000 }; });

describe("Volunteer Actor: замена кнопки «Констатировать смерть» на «Поцелуй Мимика»", () => {
  it("все условия сошлись — кнопка Поцелуя Мимика, не смерти", async () => {
    globalThis.fromUuid = async uuid =>
      uuid === "Actor.attacker" ? attackerActor(["talent.volunteerActor"]) :
      uuid === "Item.kiss" ? harlequinsKissItem() : null;
    const actor = characterActor();

    await applyDamageToActor(actor, damage({ attackerUuid: "Actor.attacker", weaponUuid: "Item.kiss" }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-kiss-of-mimic-btn");
    expect(card).not.toContain("wh-crit-death-btn");
  });

  it("атакующий без Таланта — обычная кнопка смерти", async () => {
    globalThis.fromUuid = async uuid =>
      uuid === "Actor.attacker" ? attackerActor([]) :
      uuid === "Item.kiss" ? harlequinsKissItem() : null;
    const actor = characterActor();

    await applyDamageToActor(actor, damage({ attackerUuid: "Actor.attacker", weaponUuid: "Item.kiss" }));

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-kiss-of-mimic-btn");
    expect(card).toContain("wh-crit-death-btn");
  });

  it("Талант есть, но оружие другое — обычная кнопка смерти", async () => {
    globalThis.fromUuid = async uuid =>
      uuid === "Actor.attacker" ? attackerActor(["talent.volunteerActor"]) :
      uuid === "Item.other" ? { id: "w1", name: "Меч / Sword", type: "weapon", system: {} } : null;
    const actor = characterActor();

    await applyDamageToActor(actor, damage({ attackerUuid: "Actor.attacker", weaponUuid: "Item.other" }));

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-kiss-of-mimic-btn");
    expect(card).toContain("wh-crit-death-btn");
  });

  it("нет attackerUuid/weaponUuid вовсе — обычная кнопка смерти, не падает", async () => {
    globalThis.fromUuid = async () => null;
    const actor = characterActor();

    await applyDamageToActor(actor, damage());

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-kiss-of-mimic-btn");
    expect(card).toContain("wh-crit-death-btn");
  });

  it("варп-оружие (warpSoak) — обычная кнопка смерти, даже при всех прочих условиях", async () => {
    globalThis.fromUuid = async uuid =>
      uuid === "Actor.attacker" ? attackerActor(["talent.volunteerActor"]) :
      uuid === "Item.kiss" ? harlequinsKissItem() : null;
    const actor = characterActor();

    await applyDamageToActor(actor, damage({ attackerUuid: "Actor.attacker", weaponUuid: "Item.kiss", warpSoak: true }));

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-kiss-of-mimic-btn");
    expect(card).toContain("wh-crit-death-btn");
  });
});
