// test/combat/armor-breach.test.mjs
//
// wdbc-k0ff: состояние «броня уже пробита» между ударами. applyDamageToActor
// помечает надетую броню локации как system.breached=true, когда попадание
// пробило броню по расчёту книги (стр. 42, wdbc-x1nz.2.78): AP ×2 (×3 против
// I(Cr)) после Pen, T.b не считается. Что означает пробитие для конкретных свойств
// (Sealed и т.п.) — решает читатель флага, не эта проверка (см. close_reason
// wdbc-k0ff): здесь только сам факт простановки.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { armorBreachOutcome } from "../../module/combat/armor-properties.mjs";

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
    async update() {},
    // Пометка пробития идёт одним пакетным запросом (breachArmorAtLocation).
    async updateEmbeddedDocuments(_type, patches) {
      for (const p of patches) {
        const it = list.find(i => i.id === p._id);
        if (it && p["system.breached"] !== undefined) it.system.breached = p["system.breached"];
      }
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("применение урона помечает броню пробитой", () => {
  it("урон больше AP×2 — броня локации помечается пробитой", async () => {
    const armor = armorItem({ body: 4 });
    const actor = characterActor({ armorAP: 4, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 })); // 15 > 4×2 → пробило
    expect(armor.system.breached).toBe(true);
  });

  it("весь урон поглощён — броня НЕ помечается пробитой", async () => {
    const armor = armorItem({ body: 20 });
    const actor = characterActor({ armorAP: 20, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 15 })); // 15 ≤ 20 → не пробило
    expect(armor.system.breached).toBe(false);
  });

  it("уже пробитую броню повторно не трогает (запрос не уходит снова)", async () => {
    const armor = armorItem({ body: 4, breached: true });
    const actor = characterActor({ armorAP: 4, toughnessBonus: 0, items: [armor] });
    let updateCalls = 0;
    const orig = actor.updateEmbeddedDocuments;
    actor.updateEmbeddedDocuments = async (...a) => { updateCalls++; return orig.apply(actor, a); };
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

  it("ушиб сквозь броню: непоглощённый урон есть, но AP×2 его держит — НЕ пробито", async () => {
    const armor = armorItem({ body: 6 });
    const actor = characterActor({ armorAP: 6, toughnessBonus: 4, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 12 })); // 12−10=2 урона, но 12 ≤ 6×2
    expect(armor.system.breached).toBe(false);
  });

  it("T.b в пробитии не считается: всё поглощено Стойкостью, а броня пробита", async () => {
    const armor = armorItem({ body: 3 });
    const actor = characterActor({ armorAP: 3, toughnessBonus: 10, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 12 })); // 12 ≤ 13, но 12 > 3×2
    expect(armor.system.breached).toBe(true);
  });

  it("итог пробития привязывается к карточке атаки (flags.lastBreach)", async () => {
    const armor = armorItem({ body: 6 });
    const actor = characterActor({ armorAP: 6, toughnessBonus: 0, items: [armor] });
    const updates = [];
    actor.update = async (u) => { updates.push(u); };
    await applyDamageToActor(actor, damage({ rawDamage: 10, sourceMessageId: "msg1" })); // 10 ≤ 12
    expect(updates.some(u => u["flags.warhammer-dbc.lastBreach"]?.messageId === "msg1"
      && u["flags.warhammer-dbc.lastBreach"].breached === false)).toBe(true);
  });
});

describe("armorBreachOutcome — расчёт пробития (стр. 42)", () => {
  it("AP удваивается", () => {
    expect(armorBreachOutcome({ rawDamage: 9, effArmorAP: 4 }).breached).toBe(true);
    expect(armorBreachOutcome({ rawDamage: 8, effArmorAP: 4 }).breached).toBe(false);
  });
  it("против I(Cr) — утраивается", () => {
    expect(armorBreachOutcome({ rawDamage: 10, effArmorAP: 4, damageSubtype: "crushing" }).breached).toBe(false);
    expect(armorBreachOutcome({ rawDamage: 13, effArmorAP: 4, damageSubtype: "crushing" }).breached).toBe(true);
  });
  it("прочие слагаемые Поглощения (не T.b) входят без умножения", () => {
    expect(armorBreachOutcome({ rawDamage: 10, effArmorAP: 4, otherAbsorption: 2 })).toEqual({ breached: false, breachAbsorption: 10 });
  });
});

describe("Pen вычитается до удвоения", () => {
  it("AP 6, Pen 2, урон 9: (6−2)×2 = 8 < 9 — пробито", async () => {
    const armor = armorItem({ body: 6 });
    const actor = characterActor({ armorAP: 6, toughnessBonus: 0, items: [armor] });
    await applyDamageToActor(actor, damage({ rawDamage: 9, penetration: 2 }));
    expect(armor.system.breached).toBe(true);
  });
});
