// test/rules/drukhari-armor-field-readers.test.mjs
//
// wdbc-j8cn: у пяти производных режима поля друкхарийской брони
// (constants/drukhari-armor-fields.mjs → rules/character/armour.mjs) был ровно
// один читатель — Nimble. Здесь по читателю на остальные четыре:
// Protective (+AP против среды), Flak Амортизирующего поля, Blunted (карточка
// манифестации, rules/blunted.mjs), штраф чужим психотестам (правило
// core.drukhariFieldPsyMod) и щит Защитного поля (combat/armor-field-shield.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { bluntedRating, bluntedCasterTest } from "../../module/rules/blunted.mjs";
import { desiredArmorFieldShields, armorFieldShieldPlan, ARMOR_FIELD_SHIELD_FLAG }
  from "../../module/combat/armor-field-shield.mjs";

const suit = ({ id = "a1", name = "Призрачная Броня", fieldMode = "", quality = "best", equipped = true } = {}) => ({
  id, name, type: "armor",
  system: { head: 4, body: 4, leftArm: 4, rightArm: 4, leftLeg: 4, rightLeg: 4,
            properties: [], equipped, stacks: false, quality, propRatings: {}, fieldMode },
  getFlag: () => undefined
});

function prepared(items) {
  const system = { ...new ACTOR_DATA_MODELS.character({}).toObject() };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Друкхари", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}

describe("Амортизирующее поле: Protective и Flak доходят до поглощения", () => {
  it("Призрачная Броня: Protective (4) — +4 AP против урона среды", () => {
    const on  = prepared([suit({ fieldMode: "damping" })]);
    const off = prepared([suit()]);
    expect(on.system.absorption.vsType.chemical - off.system.absorption.vsType.chemical).toBe(4);
  });

  it("Flak появляется у всех закрытых локаций, пока поле включено", () => {
    const on  = prepared([suit({ fieldMode: "damping" })]);
    const off = prepared([suit()]);
    expect(on.system.absorption.propFlags.body.doubleApVsSubtype.fragmentation).toBe(true);
    expect(off.system.absorption.propFlags.body.doubleApVsSubtype.fragmentation).toBeUndefined();
  });

  it("на Common.Q режим закрыт — ни Protective, ни Flak", () => {
    const a = prepared([suit({ fieldMode: "damping", quality: "common" })]);
    expect(a.system.absorption.propFlags.body.doubleApVsSubtype.fragmentation).toBeUndefined();
  });
});

describe("Подавляющее поле: штраф чужим психотестам", () => {
  const caster = { system: { race: "human", characteristics: {} }, items: [] };
  const power = { type: "psychicPower", name: "Молния", system: {} };

  it("психотест против цели в поле получает −20 (Призрачная Броня)", () => {
    const target = prepared([suit({ fieldMode: "suppressing" })]);
    const { mods } = resolveTest({ actor: caster, kind: "power", power, char: "wp", targetActor: target });
    expect(mods).toEqual([expect.objectContaining({ ruleId: "core.drukhariFieldPsyMod", value: -20 })]);
  });

  it("без поля и без цели — строки нет", () => {
    const target = prepared([suit()]);
    expect(resolveTest({ actor: caster, kind: "power", power, char: "wp", targetActor: target }).mods).toEqual([]);
    expect(resolveTest({ actor: caster, kind: "power", power, char: "wp", targetActor: null }).mods).toEqual([]);
  });

  it("в атаку оружием штраф не лезет", () => {
    const target = prepared([suit({ fieldMode: "suppressing" })]);
    const { mods } = resolveTest({ actor: caster, kind: "attack", weaponClass: "basic", isMelee: false, char: "bs", targetActor: target });
    expect(mods.find(m => m.ruleId === "core.drukhariFieldPsyMod")).toBeUndefined();
  });
});

describe("Blunted: Черта и Подавляющее поле", () => {
  const trait = (rating, hasRating = true) => ({ type: "trait", name: "Blunted / Затупленный", system: { hasRating, rating } });

  it("нет Черты и поля — null, а Blunted (0) — полноценный 0", () => {
    expect(bluntedRating({ system: {}, items: [] })).toBeNull();
    expect(bluntedRating({ system: { fieldBlunted: 0 }, items: [] })).toBe(0);
  });

  it("поле ДАЁТ рейтинг, а не прибавляет: максимум с Чертой", () => {
    expect(bluntedRating({ system: { fieldBlunted: 1 }, items: [trait(3)] })).toBe(3);
    expect(bluntedRating({ system: { fieldBlunted: 1 }, items: [trait(0)] })).toBe(1);
  });

  it("Подавляющее поле Призрачной Брони ставит fieldBlunted = 1", () => {
    expect(bluntedRating(prepared([suit({ fieldMode: "suppressing" })]))).toBe(1);
  });

  it("тест кастера: Psyniscience −10×X; с Warp Sight — Awareness +20−10×X", () => {
    const target = { system: {}, items: [trait(2)] };
    expect(bluntedCasterTest({ items: [] }, target, { system: { powerType: "attack" } }))
      .toEqual({ skill: "psyniscience", label: "Psyniscience", mod: -20, rating: 2 });
    const seer = { items: [{ type: "trait", name: "Warp Sight / Варп-Зрение", system: {} }] };
    expect(bluntedCasterTest(seer, target, { system: { powerType: "attack" } }).mod).toBe(0);
  });

  it("психострельба без Warp Weapon Затупленность не замечает", () => {
    const target = { system: {}, items: [trait(2)] };
    const shoot = { system: { powerType: "psychicShoot" } };
    expect(bluntedCasterTest({ items: [] }, target, shoot, [])).toBeNull();
    expect(bluntedCasterTest({ items: [] }, target, shoot, ["warpWeapon"])).not.toBeNull();
  });
});

describe("Защитное поле: встроенный щит", () => {
  const withItems = items => ({ items });

  it("надетая броня с Защитным полем требует щит 1–35/1 (Призрачная Броня)", () => {
    expect(desiredArmorFieldShields(withItems([suit({ fieldMode: "protective" })])))
      .toEqual([expect.objectContaining({ armorId: "a1", ratingMax: 35, overload: 1 })]);
  });

  it("Тканый Костюм — 1–25/5; снятая броня или другой режим — щита нет", () => {
    const wraith = suit({ name: "Психокостяной Тканый Костюм", fieldMode: "protective" });
    expect(desiredArmorFieldShields(withItems([wraith]))[0]).toEqual(expect.objectContaining({ ratingMax: 25, overload: 5 }));
    expect(desiredArmorFieldShields(withItems([suit({ fieldMode: "protective", equipped: false })]))).toEqual([]);
    expect(desiredArmorFieldShields(withItems([suit({ fieldMode: "dispersal" })]))).toEqual([]);
  });

  it("план сверки: создаёт недостающий и снимает щит выключенного поля", () => {
    const shieldOf = armorId => ({ id: `s-${armorId}`, type: "forcefield",
      getFlag: (ns, k) => (k === ARMOR_FIELD_SHIELD_FLAG ? armorId : undefined) });
    const plan1 = armorFieldShieldPlan(withItems([suit({ fieldMode: "protective" })]));
    expect(plan1.create.map(c => c.armorId)).toEqual(["a1"]);
    expect(plan1.remove).toEqual([]);

    const plan2 = armorFieldShieldPlan(withItems([suit({ fieldMode: "protective" }), shieldOf("a1")]));
    expect(plan2).toEqual({ create: [], remove: [] });

    const plan3 = armorFieldShieldPlan(withItems([suit({ fieldMode: "damping" }), shieldOf("a1")]));
    expect(plan3).toEqual({ create: [], remove: ["s-a1"] });
  });
});
