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
import { itemHasKey } from "../../module/rules/item-marker.mjs";

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

// ── Встроенный ретинальный дисплей (task-1a59, решение владельца 02.10.2026) ──
// Дисплей вшит в броню/маску/имплант — отдельного предмета «Ретинальный Дисплей»
// у персонажа нет, но книга прямо говорит, что он есть. Такие предметы несут
// метку «Возможность» device.retinalDisplay (Конструктор), а гейт прицелов
// засчитывает её любому требованию, где назван ретинальный дисплей.
//
// ПОЛНЫЙ перечень носителей метки зафиксирован здесь поимённо: добавили или
// убрали предмет — тест падает по делу, и решение принимается осознанно.
// Источник — книги в packs-src/books (Основная: «Силовая броня», «Маска
// Шпиона», «Анимус Спекулюм», «Всевидящее Око»; Аэльдари: «Ячеистая броня»,
// «Аспектная броня»; Ответвления: «Арсенал Друкхари»).
const RETINAL_KEY = "device.retinalDisplay";

const CARRIERS = {
  armor: [
    // Основная книга, «Силовая броня» (стр. 233): «Имеет ретинальный дисплей в
    // шлеме» — общее описание, под которым идёт «Броня Астартес»; Терминаторская —
    // «поверх обычных для силовой брони». Мк V Ересь НЕ входит: решение владельца
    // 02.10.2026 «не трогать» (см. тест ниже). Броня СМЕРТНЫХ (Силовая Броня,
    // Лёгкая, Саббат, Драконья Чешуя, Врантин) тоже НЕ входит — сознательно: она идёт
    // отдельным подразделом со своими оговорками («не страдает от большинства
    // недостатков силовой брони»), а дисплей в её описании не назван. Сомнительно →
    // не проставлено, вопрос в отчёте task-1a59.
    "Mk II Crusade", "Mk III Iron", "Mk IV Maximus", "Mk VI Corvus", "Mk VII Aquila",
    "Mk VIII Errant", "Mk X Primaris", "Artificer Armour", "Aegis Armour",
    "Mk I Saturnyne", "Mk II Cataphractii", "Mk III Indominus", "Mk IV Tartaros", "Terminator Aegis",
    // Книга Аэльдари, «Ячеистая броня» (стр. 91): «встроенные … ретинальный дисплей».
    "Guardian Armor", "Eldar Void Armor",
    // Там же, «Аспектная броня» (стр. 92): общее описание всех боевых аспектов; Броня
    // Экзарха — «более древняя вариация аспектной брони», в записи «считается любой
    // аспектной бронёй». Легендарные брони той же папки (Горху, Идранель, Три Луны,
    // Пластина Стража Душ, шлемы) не входят — в книге про них этого не сказано.
    "Exarch Armour", "Dark Reaper Armour", "Dire Avenger Armour", "Fire Dragon Armour", "Howling Banshee Armour",
    "Shadow Spectre Armour", "Shining Spear Armour", "Striking Scorpion Armour",
    "Swooping Hawk Armour", "Warp-Spiders Armour",
    // Ответвления, «Арсенал Друкхари» (стр. 131).
    "Kabalite Armour", "Wraithbone Woven Battlesuit", "Ghostplate Armour", "Incubus Warsuit"
  ],
  // Основная книга, «Снаряжение»: Маска Шпиона, Анимус Спекулюм (шлем со встроенным дисплеем).
  gear: ["Spy Mask", "Animus Speculum"],
  // Основная книга, «Кибернетика»: «функционал ретинального дисплея … равного Качества».
  implants: ["All-Seeing Eye"]
};

/** Живая копия предмета пака в «носимом» виде: надета/установлена. */
function worn(pack, enName, id) {
  const doc = packDoc(pack, enName);
  const item = owned(doc, id, pack === "implants" ? { installed: true } : {});
  item.system = { ...item.system, equipped: true };
  return item;
}

describe("Встроенный ретинальный дисплей — метка device.retinalDisplay (task-1a59)", () => {
  it("метку несут РОВНО перечисленные предметы пака (и никто другой)", () => {
    const found = {};
    for (const pack of ["armor", "gear", "implants", "tools", "armour-systems", "armor-mods", "weapon-mods"]) {
      for (const { doc } of allPackDocuments(pack)) {
        if (!itemHasKey(doc, RETINAL_KEY)) continue;
        (found[pack] ??= []).push(doc.name.split("/")[0].trim());
      }
    }
    const sorted = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]));
    expect(sorted(found)).toEqual(sorted(CARRIERS));
  });

  it("Мк V Ересь метку не несёт (решение владельца 02.10.2026 — не трогать)", () => {
    expect(itemHasKey(packDoc("armor", "Mk V Heresy"), RETINAL_KEY)).toBe(false);
  });

  it("Целеуказатель + надетая силовая броня Мк IV — +5/+10 без отдельного Ретинального Дисплея", () => {
    const fx = getModEffects(actorWith([modOn("Target Designator"), worn("armor", "Mk IV Maximus", "a1")]), rifle());
    expect(fx.rofSemiAttackMod).toBe(5);
    expect(fx.rofFullAttackMod).toBe(10);
  });

  it("Целеуказатель + броня Стража надета — работает; в рюкзаке (не надета) — нет", () => {
    expect(getModEffects(actorWith([modOn("Target Designator"), worn("armor", "Guardian Armor", "a1")]), rifle())
      .rofFullAttackMod).toBe(10);
    const off = worn("armor", "Guardian Armor", "a1");
    off.system.equipped = false;
    expect(getModEffects(actorWith([modOn("Target Designator"), off]), rifle()).rofFullAttackMod).toBe(0);
  });

  it("Целеуказатель + Маска Шпиона надета — работает", () => {
    expect(getModEffects(actorWith([modOn("Target Designator"), worn("gear", "Spy Mask", "g2")]), rifle())
      .rofSemiAttackMod).toBe(5);
  });

  it("Всевидящее Око: установлено — работает; не установлено — нет", () => {
    expect(getModEffects(actorWith([modOn("Target Designator"), worn("implants", "All-Seeing Eye", "i2")]), rifle())
      .rofFullAttackMod).toBe(10);
    const off = worn("implants", "All-Seeing Eye", "i2");
    off.flags[SYS].installed = false;
    off.getFlag = (scope, key) => off.flags?.[scope]?.[key];
    expect(getModEffects(actorWith([modOn("Target Designator"), off]), rifle()).rofFullAttackMod).toBe(0);
  });

  it("Омни-Прицел со встроенным дисплеем (броня Стража) — Inaccurate снят", () => {
    const inaccurate = [{ key: "inaccurate", rating: 0, rating2: 0 }];
    const actor = actorWith([modOn("Omni-Sight"), worn("armor", "Guardian Armor", "a1")]);
    const keys = mergeWeaponPropEntries(rifle(inaccurate), getModEffects(actor, rifle(inaccurate))).map(p => p.key);
    expect(keys).not.toContain("inaccurate");
  });

  it("Мк V Ересь надета — встроенного дисплея не засчитывает (ничего не трогали)", () => {
    expect(getModEffects(actorWith([modOn("Target Designator"), worn("armor", "Mk V Heresy", "a1")]), rifle())
      .rofFullAttackMod).toBe(0);
  });

  it("метка засчитывается ТОЛЬКО требованию, где назван ретинальный дисплей", () => {
    // Синтетический мод, требующий лишь Бионический Глаз: броня с дисплеем ему не помогает.
    const mod = { id: "m7", type: "weaponMod", name: "Eye-only", system: { installedOn: "w1", requiresWorn: ["Bionic Eye"] } };
    expect(modWornRequirementMet(actorWith([mod, worn("armor", "Guardian Armor", "a1")]), mod)).toBe(false);
  });
});

describe("Мод без requiresWorn — гейт не вмешивается", () => {
  it("Глушитель/любой мод без требования работает как раньше", () => {
    const mod = { id: "m9", type: "weaponMod", name: "X", system: { installedOn: "w1", effects: { attackMod: 3 } } };
    expect(modWornRequirementMet(actorWith([mod]), mod)).toBe(true);
    expect(getModEffects(actorWith([mod]), rifle()).attackMod).toBe(3);
  });
});
