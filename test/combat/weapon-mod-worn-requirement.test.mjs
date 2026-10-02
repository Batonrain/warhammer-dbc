// test/combat/weapon-mod-worn-requirement.test.mjs
//
// Модификация оружия, «бесполезная без» другого предмета на персонаже
// (wdbc-1rno.38, Sahara wdbc-1rno-38-x). Книга, Основная, «Прицелы»:
//   • Targeter / Целеуказатель: «+5 на короткие очереди и +10 на длинные
//     очереди. Интегрируется с ретинальным дисплеем, бионическим глазом или
//     MIU и бесполезен без них»;
//   • Omni-Scope / Омни-Прицел: «Интегрируется с ретинальным дисплеем или
//     бионическим глазом и бесполезен без них» (MIU здесь НЕ назван).
// Гейт — system.requiresWorn мода (список имён, достаточно любого) в
// module/combat/weapon-mods.mjs; «носит» = предмет активен по isItemActive
// (снаряжение надето, имплант установлен и исправен).
//
// Фикстуры модов и носимых предметов — настоящие документы packs-src, а не
// придуманные литералы: тест обязан падать, если пак разойдётся с кодом.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects, mergeWeaponPropEntries, modWornRequirementMet } from "../../module/combat/weapon-mods.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const SYS = "warhammer-dbc";

/** Документ пака по английской половине имени — свежая копия на каждый вызов. */
function packDoc(pack, enName) {
  const hit = allPackDocuments(pack).find(({ doc }) => doc.name.split("/")[0].trim() === enName);
  if (!hit) throw new Error(`packs-src/${pack}: нет «${enName}»`);
  return hit.doc;
}

/** Живой предмет на акторе: id + getFlag, как у документа Foundry. */
function owned(doc, id, flags = {}) {
  const item = { ...doc, id, flags: { ...(doc.flags ?? {}), [SYS]: { ...(doc.flags?.[SYS] ?? {}), ...flags } } };
  item.getFlag = (scope, key) => item.flags?.[scope]?.[key];
  return item;
}

function rifle(weaponProps = []) {
  return { id: "w1", type: "weapon", system: { equipped: true, weaponClass: "basic", weaponProps } };
}

function modOn(enName, id = "m1") {
  const item = owned(packDoc("weapon-mods", enName), id);
  item.system = { ...item.system, installedOn: "w1" };
  return item;
}

const retinal = (equipped = true) => {
  const item = owned(packDoc("gear", "Retinal Display"), "g1");
  item.system = { ...item.system, equipped };
  return item;
};
const implant = (enName, { installed = true, disabled = false } = {}) =>
  owned(packDoc("implants", enName), `i-${enName}`, { installed, disabled });

function actorWith(items) {
  const list = [...items];
  list.get = i => list.find(x => x.id === i) ?? null;
  return { id: "a1", items: list };
}

describe("Целеуказатель / Targeter (wdbc-1rno.38)", () => {
  it("данные пака: требует RD/бионический глаз/MIU, +5 короткой и +10 длинной очереди к попаданию", () => {
    const mod = packDoc("weapon-mods", "Target Designator");
    expect(mod.system.requiresWorn).toEqual(["Retinal Display", "Bionic Eye", "Mind Impulse Unit"]);
    expect(mod.system.effects.rofSemiAttackMod).toBe(5);
    expect(mod.system.effects.rofFullAttackMod).toBe(10);
    // Это бонус к ПОПАДАНИЮ, не к числу выстрелов: rofSemiMod/rofFullMod
    // (RoF на листе, sheet-helpers.mjs) Целеуказатель не трогает.
    expect(mod.system.effects.rofSemiMod).toBe(0);
    expect(mod.system.effects.rofFullMod).toBe(0);
  });

  it("без ретинального дисплея, глаза и MIU — бонусов нет", () => {
    const fx = getModEffects(actorWith([modOn("Target Designator")]), rifle());
    expect(fx.rofSemiAttackMod).toBe(0);
    expect(fx.rofFullAttackMod).toBe(0);
  });

  it("надетый Ретинальный Дисплей — +5/+10", () => {
    const fx = getModEffects(actorWith([modOn("Target Designator"), retinal(true)]), rifle());
    expect(fx.rofSemiAttackMod).toBe(5);
    expect(fx.rofFullAttackMod).toBe(10);
  });

  it("Ретинальный Дисплей в рюкзаке (не надет) — не считается", () => {
    const fx = getModEffects(actorWith([modOn("Target Designator"), retinal(false)]), rifle());
    expect(fx.rofSemiAttackMod).toBe(0);
  });

  it("установленный Бионический Глаз — работает", () => {
    const fx = getModEffects(actorWith([modOn("Target Designator"), implant("Bionic Eye")]), rifle());
    expect(fx.rofFullAttackMod).toBe(10);
  });

  it("Бионический Глаз не установлен или неисправен — не работает", () => {
    expect(getModEffects(actorWith([modOn("Target Designator"), implant("Bionic Eye", { installed: false })]), rifle())
      .rofFullAttackMod).toBe(0);
    expect(getModEffects(actorWith([modOn("Target Designator"), implant("Bionic Eye", { disabled: true })]), rifle())
      .rofFullAttackMod).toBe(0);
  });

  it("установленное MIU — работает", () => {
    const fx = getModEffects(actorWith([modOn("Target Designator"), implant("Mind Impulse Unit (MIU)")]), rifle());
    expect(fx.rofSemiAttackMod).toBe(5);
  });

  it("каждое требуемое имя находит настоящий предмет пака (страховка от опечатки)", () => {
    const mod = modOn("Target Designator");
    for (const item of [retinal(true), implant("Bionic Eye"), implant("Mind Impulse Unit (MIU)")]) {
      expect(modWornRequirementMet(actorWith([mod, item]), mod)).toBe(true);
    }
  });
});

describe("Омни-Прицел / Omni-Scope (wdbc-1rno.38)", () => {
  const inaccurate = [{ key: "inaccurate", rating: 0, rating2: 0 }];
  const keysAfter = (actor) => mergeWeaponPropEntries(rifle(inaccurate), getModEffects(actor, rifle(inaccurate))).map(p => p.key);

  it("данные пака: требует RD или бионический глаз (MIU книга не называет)", () => {
    expect(packDoc("weapon-mods", "Omni-Sight").system.requiresWorn).toEqual(["Retinal Display", "Bionic Eye"]);
  });

  it("без RD/глаза «бесполезен» — Inaccurate НЕ снимается", () => {
    expect(keysAfter(actorWith([modOn("Omni-Sight")]))).toContain("inaccurate");
  });

  it("с надетым Ретинальным Дисплеем — Inaccurate снят", () => {
    expect(keysAfter(actorWith([modOn("Omni-Sight"), retinal(true)]))).not.toContain("inaccurate");
  });

  it("с установленным Бионическим Глазом — Inaccurate снят", () => {
    expect(keysAfter(actorWith([modOn("Omni-Sight"), implant("Bionic Eye")]))).not.toContain("inaccurate");
  });

  it("MIU Омни-Прицелу не помогает", () => {
    expect(keysAfter(actorWith([modOn("Omni-Sight"), implant("Mind Impulse Unit (MIU)")]))).toContain("inaccurate");
  });
});

describe("Мод без requiresWorn — гейт не вмешивается", () => {
  it("Глушитель/любой мод без требования работает как раньше", () => {
    const mod = { id: "m9", type: "weaponMod", name: "X", system: { installedOn: "w1", effects: { attackMod: 3 } } };
    expect(modWornRequirementMet(actorWith([mod]), mod)).toBe(true);
    expect(getModEffects(actorWith([mod]), rifle()).attackMod).toBe(3);
  });
});
