// test/combat/armor-properties.test.mjs
//
// Движок автоматизации свойств брони (Conductive/Flak/Soft/Rods/Open/Primitive)
// — без Foundry, чистые функции. Зеркало test/combat/attack-outcome.test.mjs
// по духу: правила книги, не разметка.

import { describe, it, expect } from "vitest";
import {
  resolveArmorProps, aggregateArmorAuto, mergeArmorLocFlags,
  emptyArmorLocFlags, resolveArmorAbsorptionAP, aggregateArmorSkillMods
} from "../../module/combat/armor-properties.mjs";

describe("resolveArmorProps", () => {
  it("разрешает известные ключи, отбрасывает неизвестные", () => {
    const item = { system: { properties: ["conductive", "unknownKey", "flak"] } };
    const props = resolveArmorProps(item);
    expect(props.map(p => p.key)).toEqual(["conductive", "flak"]);
    expect(props.every(p => p.def)).toBe(true);
  });

  it("не падает без system.properties", () => {
    expect(resolveArmorProps({ system: {} })).toEqual([]);
    expect(resolveArmorProps(null)).toEqual([]);
  });
});

describe("aggregateArmorAuto", () => {
  it("пустой список — все флаги ложны", () => {
    expect(aggregateArmorAuto([])).toEqual(emptyArmorLocFlags());
  });

  it("conductive → noEnergy", () => {
    const props = resolveArmorProps({ system: { properties: ["conductive"] } });
    expect(aggregateArmorAuto(props).noEnergy).toBe(true);
  });

  it("soft → noImpact", () => {
    const props = resolveArmorProps({ system: { properties: ["soft"] } });
    expect(aggregateArmorAuto(props).noImpact).toBe(true);
  });

  it("flak → doubleBlast", () => {
    const props = resolveArmorProps({ system: { properties: ["flak"] } });
    expect(aggregateArmorAuto(props).doubleBlast).toBe(true);
  });

  it("rods → noRanged и noJointCalled одновременно", () => {
    const props = resolveArmorProps({ system: { properties: ["rods"] } });
    const a = aggregateArmorAuto(props);
    expect(a.noRanged).toBe(true);
    expect(a.noJointCalled).toBe(true);
    expect(a.noEyeCalled).toBe(false);
  });

  it("open → noEyeCalled, не noJointCalled", () => {
    const props = resolveArmorProps({ system: { properties: ["open"] } });
    const a = aggregateArmorAuto(props);
    expect(a.noEyeCalled).toBe(true);
    expect(a.noJointCalled).toBe(false);
  });

  it("primitive (броня) → blocksPrimitiveDouble", () => {
    const props = resolveArmorProps({ system: { properties: ["primitive"] } });
    expect(aggregateArmorAuto(props).blocksPrimitiveDouble).toBe(true);
  });

  it("свойства без auto (gorget, hard, void…) не поднимают ни одного флага", () => {
    // cloak сюда больше не входит — с wdbc-p5el у него появился auto.frontArcNoProtect,
    // см. отдельный describe "aggregateArmorAuto — cloak" ниже.
    const props = resolveArmorProps({ system: { properties: ["gorget", "hard", "void"] } });
    expect(aggregateArmorAuto(props)).toEqual(emptyArmorLocFlags());
  });
});

describe("aggregateArmorSkillMods (wdbc-vzyi)", () => {
  it("пустой список — пустая карта", () => {
    expect(aggregateArmorSkillMods([])).toEqual({});
  });

  it("heavy → stealth −10", () => {
    const props = resolveArmorProps({ system: { properties: ["heavy"] } });
    expect(aggregateArmorSkillMods(props)).toEqual({ stealth: -10 });
  });

  it("stealthed → stealth +10", () => {
    const props = resolveArmorProps({ system: { properties: ["stealthed"] } });
    expect(aggregateArmorSkillMods(props)).toEqual({ stealth: 10 });
  });

  it("heavy и stealthed на одном предмете — складываются в 0", () => {
    const props = resolveArmorProps({ system: { properties: ["heavy", "stealthed"] } });
    expect(aggregateArmorSkillMods(props)).toEqual({ stealth: 0 });
  });

  it("свойства без skillMod (conductive, gorget…) не поднимают запись", () => {
    const props = resolveArmorProps({ system: { properties: ["conductive", "gorget"] } });
    expect(aggregateArmorSkillMods(props)).toEqual({});
  });
});

describe("aggregateArmorAuto — cloak (wdbc-p5el)", () => {
  it("cloak → frontArcNoProtect", () => {
    const props = resolveArmorProps({ system: { properties: ["cloak"] } });
    expect(aggregateArmorAuto(props).frontArcNoProtect).toBe(true);
  });
});

describe("mergeArmorLocFlags", () => {
  it("OR двух наборов флагов от разных предметов на одной локации", () => {
    const a = { ...emptyArmorLocFlags(), noEnergy: true };
    const b = { ...emptyArmorLocFlags(), doubleBlast: true };
    const merged = mergeArmorLocFlags(a, b);
    expect(merged.noEnergy).toBe(true);
    expect(merged.doubleBlast).toBe(true);
    expect(merged.noImpact).toBe(false);
  });
});

describe("resolveArmorAbsorptionAP", () => {
  it("без флагов и без Primitive — просто база + бонус по типу", () => {
    const ap = resolveArmorAbsorptionAP({ baseArmorAP: 6, vsTypeBonus: 2, damageType: "impact" });
    expect(ap).toBe(8);
  });

  it("Conductive обнуляет AP только против Энергетического урона", () => {
    const flags = { ...emptyArmorLocFlags(), noEnergy: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "energy", flags })).toBe(0);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", flags })).toBe(6);
  });

  it("Мягкая (soft) обнуляет AP только против Ударного урона", () => {
    const flags = { ...emptyArmorLocFlags(), noImpact: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", flags })).toBe(0);
  });

  it("Стержни (rods) обнуляют AP от стрелковой атаки, но не от рукопашной", () => {
    const flags = { ...emptyArmorLocFlags(), noRanged: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", melee: false, flags })).toBe(0);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", melee: true,  flags })).toBe(6);
  });

  it("Стержни обнуляют AP при Избирательном в Сочленение, но не в другие части", () => {
    const flags = { ...emptyArmorLocFlags(), noJointCalled: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", hitLocation: "Сочленение / Шея", melee: true, flags })).toBe(0);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", hitLocation: "Торс", melee: true, flags })).toBe(6);
  });

  it("Открытый шлем обнуляет AP только при попадании в Глаз", () => {
    const flags = { ...emptyArmorLocFlags(), noEyeCalled: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 4, damageType: "impact", hitLocation: "Глаз (Голова)", melee: true, flags })).toBe(0);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 4, damageType: "impact", hitLocation: "Голова", melee: true, flags })).toBe(4);
  });

  it("Флак удваивает AP только против Взрывного урона", () => {
    const flags = { ...emptyArmorLocFlags(), doubleBlast: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 5, damageType: "blast", flags })).toBe(10);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 5, damageType: "impact", flags })).toBe(5);
  });

  it("Флак удваивает уже с учётом vsType-бонуса (моды брони)", () => {
    const flags = { ...emptyArmorLocFlags(), doubleBlast: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 5, vsTypeBonus: 1, damageType: "blast", flags })).toBe(12);
  });

  it("Cloak: обнуляет AP локации при фронтальном хите, не трогает нефронтальный (wdbc-p5el)", () => {
    const flags = { ...emptyArmorLocFlags(), frontArcNoProtect: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", flags, frontArcHit: true })).toBe(0);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", flags, frontArcHit: false })).toBe(6);
  });

  it("frontArcHit сам по себе ничего не делает без свойства Cloak на броне", () => {
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", frontArcHit: true })).toBe(6);
  });

  it("Примитивное оружие удваивает AP (макс +6) без флага брони", () => {
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 4, damageType: "impact", primitive: true })).toBe(8);
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 10, damageType: "impact", primitive: true })).toBe(16);
  });

  it("Примитивная броня блокирует бонус Примитивного оружия", () => {
    const flags = { ...emptyArmorLocFlags(), blocksPrimitiveDouble: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 4, damageType: "impact", primitive: true, flags })).toBe(4);
  });

  it("Примитивное оружие не удваивает нулевой/отрицательный AP", () => {
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 0, damageType: "impact", primitive: true })).toBe(0);
  });

  it("обнуление свойством отменяет и vsType-бонус, и удвоение Примитивным", () => {
    const flags = { ...emptyArmorLocFlags(), noEnergy: true };
    const ap = resolveArmorAbsorptionAP({
      baseArmorAP: 6, vsTypeBonus: 4, damageType: "energy", primitive: true, flags
    });
    expect(ap).toBe(0);
  });
});
