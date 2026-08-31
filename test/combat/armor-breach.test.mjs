// test/combat/armor-breach.test.mjs
//
// wdbc-k0ff: состояние «броня уже пробита» между ударами. applyDamageToActor
// помечает надетую броню локации как system.breached=true, когда попадание
// дало непоглощённый урон. Что означает пробитие для конкретных свойств
// (Sealed и т.п.) — решает читатель флага, не эта проверка (см. close_reason
// wdbc-k0ff): здесь только сам факт простановки.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function armorItem({ id = "arm1", body = 6, equipped = true, breached = false } = {}) {
  const item = {
    id, type: "armor",
    system: { equipped, body, head: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0, breached },
    async update(patch) {
      if (patch["system.breached"] !== undefined) item.system.breached = patch["system.breached"];
    }
  };
  return item;
}

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, items = [] } = {}) {
  const list = Object.assign([...items], { contents: [...items] });
  return {
    id: "char1", name: "Стойкий", type: "character", items: list,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    async update() {}
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("применение урона помечает броню пробитой", () => {
  it("непоглощённый урон дошёл — броня локации помечается пробитой", async () => {
    const armor = armorItem({ body: 4 });
    const actor = characterActor({ armorAP: 4, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 })); // 15 > 4 → пробило
    expect(armor.system.breached).toBe(true);
  });

  it("весь урон поглощён — броня НЕ помечается пробитой", async () => {
    const armor = armorItem({ body: 20 });
    const actor = characterActor({ armorAP: 20, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 })); // 15 ≤ 20 → не пробило
    expect(armor.system.breached).toBe(false);
  });

  it("уже пробитую броню повторно не трогает (update не зовётся снова)", async () => {
    const armor = armorItem({ body: 4, breached: true });
    let updateCalls = 0;
    armor.update = async patch => { updateCalls++; if (patch["system.breached"] !== undefined) armor.system.breached = patch["system.breached"]; };
    const actor = characterActor({ armorAP: 4, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(updateCalls).toBe(0);
  });

  it("снятая (не equipped) броня не помечается", async () => {
    const armor = armorItem({ body: 4, equipped: false });
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));
    expect(armor.system.breached).toBe(false);
  });

  it("Варп-оружие (warpSoak) обходит броню целиком — не считается пробитием", async () => {
    const armor = armorItem({ body: 20 });
    const actor = characterActor({ armorAP: 20, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true }));
    expect(armor.system.breached).toBe(false);
  });

  it("другая локация (Голова) не задевает броню Торса", async () => {
    const armor = armorItem({ body: 4 });
    const actor = characterActor({ armorAP: 4, toughnessBonus: 0, items: [armor] });
    // absorption.head не задан у стенда — используем 0 AP головы через тот же actor,
    // важна только локация: у armor нет AP на голову (head:0), брешь ставить не должно.
    actor.system.absorption.head = 0;
    await applyDamageToActor(actor, damage({ rawDamage: 15, hitLocation: "Голова" }));
    expect(armor.system.breached).toBe(false);
  });
});
