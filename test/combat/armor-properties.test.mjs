// test/combat/armor-properties.test.mjs
//
// Движок автоматизации свойств брони (Conductive/Flak/Soft/Rods/Open/Primitive)
// — без Foundry, чистые функции. Зеркало test/combat/attack-outcome.test.mjs
// по духу: правила книги, не разметка.

import { describe, it, expect, vi } from "vitest";
import {
  resolveArmorProps, aggregateArmorAuto, mergeArmorLocFlags,
  emptyArmorLocFlags, resolveArmorAbsorptionAP, aggregateArmorSkillMods,
  breachArmorAtLocation
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

  it("в Глаз: AP шлема игнорируется, естественная броня головы остаётся", () => {
    // Голова 6 = шлем 4 + естественная 2 (Черта/имплант): в Глаз — только 2.
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, wornAP: 4, damageType: "impact", hitLocation: "Глаз (Голова)" })).toBe(2);
    // Силовой шлем: 4 на линзы + естественная 2.
    const power = { ...emptyArmorLocFlags(), isPowerArmor: true };
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 10, wornAP: 8, damageType: "impact", hitLocation: "Глаз (Голова)", flags: power })).toBe(6);
    // Без разбивки (wornAP не передан) — весь AP считается шлемом, как раньше.
    expect(resolveArmorAbsorptionAP({ baseArmorAP: 6, damageType: "impact", hitLocation: "Глаз (Голова)" })).toBe(0);
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

describe("breachArmorAtLocation (wdbc-k0ff)", () => {
  let nextId = 0;
  const armorItem = (over = {}) => ({
    id: `a${++nextId}`, type: "armor",
    system: { equipped: true, body: 4, head: 0, breached: false, ...over }
  });
  /** Актор с заглушкой пакетного обновления — как у настоящего Actor. */
  const actorWith = (...items) => ({
    items,
    updateEmbeddedDocuments: vi.fn(async (_type, patches) => {
      for (const p of patches) items.find(i => i.id === p._id).system.breached = p["system.breached"];
    })
  });

  it("помечает надетую броню, покрывающую локацию, как пробитую — одним запросом", async () => {
    const item = armorItem();
    const actor = actorWith(item);
    const n = await breachArmorAtLocation(actor, "body");
    expect(n).toBe(1);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ _id: item.id, "system.breached": true }]);
    expect(item.system.breached).toBe(true);
  });

  it("не трогает локацию, которую предмет не покрывает (AP===0)", async () => {
    const actor = actorWith(armorItem());
    await breachArmorAtLocation(actor, "head");
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("не трогает снятую (не equipped) броню", async () => {
    const actor = actorWith(armorItem({ equipped: false }));
    await breachArmorAtLocation(actor, "body");
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("уже пробитую не трогает повторно", async () => {
    const actor = actorWith(armorItem({ breached: true }));
    await breachArmorAtLocation(actor, "body");
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("несколько слоёв на одной локации (stacks) — помечаются все разом, одним запросом", async () => {
    const a = armorItem({ body: 2 });
    const b = armorItem({ body: 3 });
    const actor = actorWith(a, b);
    const n = await breachArmorAtLocation(actor, "body");
    expect(n).toBe(2);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledOnce();
    expect(a.system.breached).toBe(true);
    expect(b.system.breached).toBe(true);
  });
});
