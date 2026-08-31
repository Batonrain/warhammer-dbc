// test/documents/armor-properties-flags.test.mjs
//
// system.absorption.propFlags[loc] — собирается в prepareDerivedData из
// system.properties[] надетой брони (module/combat/armor-properties.mjs).
// Тот же стенд-приём, что в char-bonus-reaches-armor.test.mjs: prepareDerivedData
// вызывается напрямую на подставном акторе, без живого документа Foundry.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function armorItem({ id, head = 0, body = 0, properties = [], equipped = true, stacks = false } = {}) {
  return {
    id, name: `Броня ${id}`, type: "armor",
    system: { head, body, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0,
              properties, equipped, stacks, quality: "common" },
    getFlag: () => undefined
  };
}

function characterWith(items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("system.absorption.propFlags", () => {
  it("без брони — все локации с пустыми флагами", () => {
    const system = characterWith();
    expect(system.absorption.propFlags.body.noEnergy).toBe(false);
    expect(system.absorption.propFlags.head.noRanged).toBe(false);
  });

  it("Conductive на нагруднике поднимает noEnergy только у тела", () => {
    const system = characterWith([
      armorItem({ id: "a1", body: 6, properties: ["conductive"] })
    ]);
    expect(system.absorption.propFlags.body.noEnergy).toBe(true);
    expect(system.absorption.propFlags.head.noEnergy).toBe(false);
  });

  it("не отмечает локацию, где у этого предмета AP === 0", () => {
    // Свойство есть, но AP головы у этого предмета нулевой — предмет её не защищает.
    const system = characterWith([
      armorItem({ id: "a1", body: 6, head: 0, properties: ["conductive"] })
    ]);
    expect(system.absorption.propFlags.head.noEnergy).toBe(false);
  });

  it("два предмета на одной локации — флаги ИЛИ (OR), не перезаписывают друг друга", () => {
    const system = characterWith([
      armorItem({ id: "a1", body: 4, properties: ["conductive"], stacks: true }),
      armorItem({ id: "a2", body: 2, properties: ["flak"], stacks: true })
    ]);
    expect(system.absorption.propFlags.body.noEnergy).toBe(true);
    expect(system.absorption.propFlags.body.doubleBlast).toBe(true);
  });

  it("снятая (не equipped) броня не участвует", () => {
    const system = characterWith([
      armorItem({ id: "a1", body: 6, properties: ["conductive"], equipped: false })
    ]);
    expect(system.absorption.propFlags.body.noEnergy).toBe(false);
  });

  it("свойство без auto-директивы (gorget) не поднимает флаги", () => {
    const system = characterWith([
      armorItem({ id: "a1", head: 3, properties: ["gorget"] })
    ]);
    expect(system.absorption.propFlags.head).toEqual({
      noEnergy: false, noImpact: false, doubleBlast: false,
      noRanged: false, noJointCalled: false, noEyeCalled: false,
      blocksPrimitiveDouble: false, noJointReduction: false, isPowerArmor: false
    });
  });
});
