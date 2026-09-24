// test/combat/damage-shield-arc-primitive.test.mjs
//
// Щит (core.json, «Типы Рукопашного Оружия»): «Он добавляет этот АР к броне
// руки... от атак спереди и с того боку, который прикрывает рука со щитом
// (в арке 180°)» — геометрия арки не считается системой (нет отслеживания
// угла атаки на сцене), решает ГМ галочкой «Цель вне арки щита» на кнопке
// применения урона (opts.shieldOutOfArc здесь). «Если щит имеет свойство
// Primitive, АР от него считается примитивной бронёй, кроме как от атак от
// примитивного стрелкового оружия» — melee/ranged-условная блокировка
// удвоения AP атакующим Primitive-оружием.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

beforeEach(resetCaptured);

function characterActor({ body = 10, noShieldBody = 2, shieldSource = true, shieldPrimitive = false, wounds = 20 } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Щитоносец", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: {
        body, toughnessBonus: 0, propFlags: {}, wornOnly: { body }, vsType: {}, vsSubtype: {},
        noShield: { body: noShieldBody },
        shieldSourceLoc: { body: shieldSource },
        shieldPrimitiveLoc: { body: shieldPrimitive }
      },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([], { contents: [] }),
    getFlag: () => undefined,
    setFlag: async () => {},
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"] !== undefined) this.system.wounds.value = data["system.wounds.value"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 20, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Атакующий", weaponName: "Тестовое оружие", melee: true, ...over
});

describe("Щит вне арки: АР щита не считается на этом попадании", () => {
  it("в арке (по умолчанию) — АР щита (10) поглощает, 20-10=10 урона", async () => {
    const actor = characterActor({ body: 10, noShieldBody: 2 });
    await applyDamageToActor(actor, damage({ rawDamage: 20 }));
    expect(actor.system.wounds.value).toBe(10); // 20 - 10
  });

  it("вне арки — считается АР БЕЗ щита (2), 20-2=18 урона", async () => {
    const actor = characterActor({ body: 10, noShieldBody: 2 });
    await applyDamageToActor(actor, damage({ rawDamage: 20, shieldOutOfArc: true }));
    expect(actor.system.wounds.value).toBe(2); // 20 - 18
  });

  it("вне арки, но щит НЕ был источником максимума (обычная броня победила) — ничего не меняется", async () => {
    // shieldSourceLoc:false — обычная броня уже дала 10 сама, без щита.
    const actor = characterActor({ body: 10, noShieldBody: 10, shieldSource: false });
    await applyDamageToActor(actor, damage({ rawDamage: 20, shieldOutOfArc: true }));
    expect(actor.system.wounds.value).toBe(10); // 20 - 10, как и в арке
  });
});

describe("Primitive-броня щита: блокирует удвоение AP только от рукопашных атак", () => {
  it("рукопашная Primitive-атака, Primitive-щит — удвоения нет (AP остаётся 4)", async () => {
    const actor = characterActor({ body: 4, noShieldBody: 0, shieldPrimitive: true });
    await applyDamageToActor(actor, damage({ rawDamage: 20, melee: true, primitive: true }));
    expect(actor.system.wounds.value).toBe(4); // 20 - 4
  });

  it("стрелковая Primitive-атака, тот же Primitive-щит — удвоение проходит (AP 4→8)", async () => {
    const actor = characterActor({ body: 4, noShieldBody: 0, shieldPrimitive: true });
    await applyDamageToActor(actor, damage({ rawDamage: 20, melee: false, primitive: true }));
    expect(actor.system.wounds.value).toBe(8); // 20 - (4+4)
  });

  it("рукопашная Primitive-атака, но щит НЕ Primitive — удвоение проходит как обычно", async () => {
    const actor = characterActor({ body: 4, noShieldBody: 0, shieldPrimitive: false });
    await applyDamageToActor(actor, damage({ rawDamage: 20, melee: true, primitive: true }));
    expect(actor.system.wounds.value).toBe(8); // 20 - (4+4), обычная примитивная броня не блокирует
  });
});
