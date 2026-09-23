// test/combat/soulfire.test.mjs
//
// Огонь Души (module/combat/soulfire.mjs): при Успехе манифестации попадание
// пламени получает +PRd5 урона и игнорирует иммунитет к E(Fl), а псайкер —
// PR+1d5 урона в W. Сама манифестация — обычный executePsychotest, здесь
// проверяется то, что делается с её исходом, и пробой иммунитета в
// applyDamageToActor.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { boostHit, soulfirePower } from "../../module/combat/soulfire.mjs";

beforeEach(resetCaptured);

/** Кнопка «Применить урон» (атака оружием: `<b>` внутри кнопки) и кнопка силы. */
function buttons(damage) {
  const b = { textContent: String(damage) };
  return {
    applyBtn: { dataset: { damage: String(damage) }, textContent: `Применить урон: ${damage}`, querySelector: () => b, b },
    btn: { disabled: false, textContent: "" }
  };
}

/** Строка психосилы: `<span>… <b>11</b></span><button>11 → Торс</button>`. */
function psychicButtons(damage) {
  const label = { textContent: String(damage) };
  const applyBtn = { dataset: { damage: String(damage) }, textContent: `${damage} → Торс`,
    querySelector: () => null, parentElement: { querySelectorAll: () => [label] } };
  return { applyBtn, label, btn: { disabled: false, textContent: "" } };
}

function psyker(wpDamage = 0) {
  const updates = [];
  return {
    name: "Пиромант", uuid: "Actor.p", updates,
    system: { charDamage: { wp: wpDamage } },
    items: [{ type: "psychicPower", name: "Soulfire / Огонь Души" }],
    async update(data) { updates.push(data); }
  };
}

describe("Огонь Души: исход манифестации", () => {
  it("находит силу по любой половине имени", () => {
    expect(soulfirePower(psyker())).not.toBeNull();
    expect(soulfirePower({ items: [{ type: "psychicPower", name: "Fire Bolt / Огненный Снаряд" }] })).toBeNull();
  });

  it("+PRd5 к попаданию, флаг пробоя иммунитета, PR+1d5 урона в W", async () => {
    const actor = psyker(-2);
    const { applyBtn, btn } = buttons(12);
    // 3d5 → 2+4+5 = 11; 3+1d5 → 3+4 = 7
    captured.dice = [2, 4, 5, 4];
    await boostHit(actor, applyBtn, btn, 3);

    expect(applyBtn.dataset.damage).toBe("23");
    expect(applyBtn.b.textContent).toBe("23");
    expect(applyBtn.dataset.ignoreSubtypeImmunity).toBe("1");
    expect(btn.disabled).toBe(true);
    expect(actor.updates).toContainEqual({ "system.charDamage.wp": -9 });
  });

  // Живая проверка 23.09.2026: на карточке психосилы число на кнопке и в
  // подписи оставалось старым — `<b>` там не внутри кнопки.
  it("карточка психосилы: новое число и на кнопке, и в подписи строки", async () => {
    const { applyBtn, label, btn } = psychicButtons(11);
    captured.dice = [2, 4, 5, 4];
    await boostHit(psyker(), applyBtn, btn, 3);
    expect(applyBtn.textContent).toBe("22 → Торс");
    expect(label.textContent).toBe("22");
  });
});

describe("applyDamageToActor: ignoreSubtypeImmunity", () => {
  function immuneToFlame() {
    const items = [{
      id: "imm", name: "Иммунитет к огню", type: "mutation", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "damageImmunity.subtype.flame", label: "" }
      ] }] } }
    }];
    return {
      id: "t", name: "Огнеупорный", type: "character", uuid: "Actor.t",
      system: { absorption: { body: 0, toughnessBonus: 0, propFlags: {} }, wounds: { value: 20, critical: 0, max: 20 } },
      items: Object.assign([...items], { contents: items }),
      async update(data) {
        if (data["system.wounds.value"] !== undefined) this.system.wounds.value = data["system.wounds.value"];
      }
    };
  }
  const hit = over => ({ rawDamage: 15, penetration: 0, damageType: "energy", damageSubtype: "flame",
    hitLocation: "Торс", attackerName: "Пиромант", weaponName: "Огонь", ...over });

  it("без флага иммунитет к E(Fl) гасит попадание", async () => {
    const actor = immuneToFlame();
    await applyDamageToActor(actor, hit());
    expect(actor.system.wounds.value).toBe(20);
  });

  it("с флагом Огня Души попадание проходит", async () => {
    const actor = immuneToFlame();
    await applyDamageToActor(actor, hit({ ignoreSubtypeImmunity: true }));
    expect(actor.system.wounds.value).toBe(5);
  });
});
