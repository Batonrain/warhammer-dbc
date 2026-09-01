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

function armorItem({ id, head = 0, body = 0, leftArm = 0, rightArm = 0, leftLeg = 0, rightLeg = 0,
                      properties = [], equipped = true, stacks = false,
                      propRatings = {}, breached = false } = {}) {
  return {
    id, name: `Броня ${id}`, type: "armor",
    system: { head, body, leftArm, rightArm, leftLeg, rightLeg,
              properties, equipped, stacks, quality: "common", propRatings, breached },
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

  it("Cloak на плаще поднимает frontArcNoProtect только у тела (wdbc-p5el)", () => {
    const system = characterWith([
      armorItem({ id: "a1", body: 2, properties: ["cloak"] })
    ]);
    expect(system.absorption.propFlags.body.frontArcNoProtect).toBe(true);
    expect(system.absorption.propFlags.head.frontArcNoProtect).toBe(false);
  });

  it("снятая (не equipped) броня не участвует", () => {
    const system = characterWith([
      armorItem({ id: "a1", body: 6, properties: ["conductive"], equipped: false })
    ]);
    expect(system.absorption.propFlags.body.noEnergy).toBe(false);
  });

  it("свойство без auto-директивы (undersuit) не поднимает флаги", () => {
    const system = characterWith([
      armorItem({ id: "a1", head: 3, properties: ["undersuit"] })
    ]);
    expect(system.absorption.propFlags.head).toEqual({
      noEnergy: false, noImpact: false, doubleBlast: false,
      noRanged: false, noJointCalled: false, noEyeCalled: false,
      blocksPrimitiveDouble: false, noJointReduction: false, isPowerArmor: false,
      frontArcNoProtect: false, runesOfProtection: false, gorgetRating: 0
    });
  });

  it("Gorget без рейтинга в propRatings — gorgetRating остаётся 0 (wdbc-8b5)", () => {
    const system = characterWith([
      armorItem({ id: "a1", head: 3, properties: ["gorget"] })
    ]);
    expect(system.absorption.propFlags.head.gorgetRating).toBe(0);
  });

  it("Gorget с рейтингом в propRatings — gorgetRating доходит до propFlags.head (wdbc-8b5)", () => {
    const system = characterWith([
      armorItem({ id: "a1", head: 3, properties: ["gorget"], propRatings: { gorget: 8 } })
    ]);
    expect(system.absorption.propFlags.head.gorgetRating).toBe(8);
    expect(system.absorption.propFlags.body.gorgetRating).toBe(0);
  });

  it("Protective с рейтингом — armorVsType.chemical суммирует X (wdbc-8b5)", () => {
    const system = characterWith([
      armorItem({ id: "a1", body: 4, properties: ["protective"], propRatings: { protective: 3 } })
    ]);
    expect(system.absorption.vsType.chemical).toBe(3);
  });

  it("Sealed на всех 6 локациях и непробитая — sealedFullSuit true (wdbc-8b5)", () => {
    const full = { head: 1, body: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1, properties: ["sealed"] };
    const system = characterWith([armorItem({ id: "a1", ...full })]);
    expect(system.sealedFullSuit).toBe(true);
  });

  it("Sealed только на части локаций — sealedFullSuit false (wdbc-8b5)", () => {
    const system = characterWith([
      armorItem({ id: "a1", head: 1, body: 1, properties: ["sealed"] })
    ]);
    expect(system.sealedFullSuit).toBe(false);
  });

  it("Sealed на всех локациях, но одна пробита — sealedFullSuit false (wdbc-8b5)", () => {
    const system = characterWith([
      armorItem({ id: "a1", head: 1, body: 1, leftArm: 1, rightArm: 1, leftLeg: 1, properties: ["sealed"] }),
      armorItem({ id: "a2", rightLeg: 1, properties: ["sealed"], breached: true })
    ]);
    expect(system.sealedFullSuit).toBe(false);
  });
});
