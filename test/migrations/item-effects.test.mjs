// test/migrations/item-effects.test.mjs
//
// Числовая механика Черт, Талантов, имплантов и модификаций раньше лежала в
// `system.effects.*` и складывалась вручную в prepareDerivedData. Теперь её
// несёт embedded ActiveEffect, а старое поле актор читает только у НЕ
// мигрированных предметов (documents/actor.mjs: `getFlag("migratedEffect") ? {}
// : item.system.effects`). Отсюда обе цены ошибки — по разные стороны флага:
//
//  - предмет с флагом, но без эффекта, механику не «оставляет в старом формате»,
//    а теряет вовсе. Так в паках лежат 4 органа Геносемени (Бископея — +2 к
//    бонусу Силы Астартес): флаг от прошлой версии миграции есть, эффекта нет;
//  - предмет с флагом, чья механика уехала в Конструктор (`flags.mechanics`,
//    apps/mechanics.mjs), эффекты получает от него — при получении актором. Его
//    system.effects — копия той же механики, и перенос удвоил бы бонусы. Так
//    устроены 13 Родных миров и 8 Предсказаний.
//
// Поэтому признак «уже перенесено» здесь — сама механика в эффектах (по ключам,
// не по имени эффекта) плюс флаг Конструктора, а не `migratedEffect`.
//
// Главная проверка — равенство результата: то, что окажется на предмете после
// миграции, должно совпадать с `legacyEffectsToChanges(system.effects)` — той же
// функцией, которой пользуется библиотека эффектов. Проверяется и на выдуманных
// предметах, и на настоящих данных packs-src.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { legacyEffectsToChanges } from "../../module/constants/effect-keys.mjs";
import { migrateItemEffects, repairCharValueEffectKeys, dropMechanicsDuplicates,
         repairCharBonusEffectKeys, repairDeadArmourKeys, migrateAllItemEffects,
         adoptMechanicsEffects, MIGRATE_EFFECT_TYPES,
         legacyOnlyKeys } from "../../module/migrations/item-effects.mjs";
import { describeMechEntry, characteristicEffectKey } from "../../module/apps/mechanics.mjs";

const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");
const CHAR_BONUS = { charBonuses: [{ stat: "s", value: 2 }] };

/** Предмет-заглушка: флаги, список эффектов и запись новых — больше миграции нечего. */
function itemDoc({ type = "trait", name = "Черта", effects = {},
                   flags = {}, fx = [], system = {} } = {}) {
  const own = { ...flags };
  const doc = {
    id: "item-1", type, name, img: "icons/svg/aura.svg",
    system: { effects, ...system },
    effects: fx.map((f, i) => {
      const effect = structuredClone(f);
      effect.id = effect._id ?? `fx-${i}`;
      // Починка правит только этот ключ — больше заглушке знать нечего.
      effect.update = async data => { effect.system.changes = data["system.changes"]; return effect; };
      // Пометка эффекта записью Конструктора (adoptMechanicsEffects).
      const own = { ...(effect.flags?.["warhammer-dbc"] ?? {}) };
      effect.getFlag = (_scope, key) => own[key];
      effect.setFlag = async (_scope, key, value) => { own[key] = value; return effect; };
      return effect;
    }),
    getFlag: (_scope, key) => own[key],
    setFlag: async (_scope, key, value) => { own[key] = value; return value; },
    unsetFlag: async (_scope, key) => { delete own[key]; },
    createEmbeddedDocuments: async (_type, docs) => {
      doc.effects.push(...docs.map(d => structuredClone(d)));
      return docs;
    },
    deleteEmbeddedDocuments: async (_type, ids) => {
      doc.effects = doc.effects.filter(f => !ids.includes(f.id));
      return ids;
    }
  };
  return doc;
}

/** Все changes, лежащие на предмете (в любом его эффекте). */
const changesOf = item => item.effects.flatMap(f => f.system?.changes ?? []);

beforeEach(() => {
  globalThis.game.actors = [];
  globalThis.game.packs  = new Map();
});

describe("перенос system.effects в ActiveEffect", () => {
  it("предмет прошлого формата получает ровно те changes, что даёт legacyEffectsToChanges", async () => {
    const effects = { charBonuses: [{ stat: "s", value: 2 }], armourAll: 2, fearRating: 1 };
    const item = itemDoc({ effects });

    expect(await migrateItemEffects(item)).toBe(true);

    expect(changesOf(item)).toEqual(legacyEffectsToChanges(effects));
    expect(item.effects[0].name).toBe("Черта (перенесено)");
    expect(item.effects[0].img).toBe(item.img);
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBe(true);
  });

  it("повторный прогон ничего не дублирует", async () => {
    const item = itemDoc({ effects: CHAR_BONUS });

    await migrateItemEffects(item);
    const after = changesOf(item);
    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.effects).toHaveLength(1);
    expect(changesOf(item)).toEqual(after);
  });

  it("флаг без эффекта и без Конструктора миграцией не считается", async () => {
    // Состояние 4 органов Геносемени в паках: пометка есть, механика мертва.
    const item = itemDoc({ name: "Бископея", effects: CHAR_BONUS,
                           flags: { migratedEffect: true } });

    expect(await migrateItemEffects(item)).toBe(true);

    expect(changesOf(item)).toEqual(legacyEffectsToChanges(CHAR_BONUS));
  });

  it("механика Конструктора не переносится второй раз", async () => {
    // Родные миры и Предсказания: system.effects — копия механики Конструктора,
    // а эффекты по ней заводит он сам, когда предмет попадает к актору.
    const item = itemDoc({ type: "homeworld", name: "Мир-улей",
                           effects: { charValueBonuses: [{ stat: "ag", value: 3 }] },
                           flags: { migratedEffect: true, mechanics: [{ id: "g1", entries: [
                             { kind: "characteristic", charKey: "ag", field: "total", op: "add", value: 3 }
                           ] }] } });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.effects).toEqual([]);
  });

  it("переименованный перенесённый эффект вторым не становится", async () => {
    const item = itemDoc({ effects: CHAR_BONUS, flags: { migratedEffect: true },
                           fx: [{ name: "Бонус Силы", system: { changes:
                             legacyEffectsToChanges(CHAR_BONUS) } }] });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.effects).toHaveLength(1);
  });

  it("переносится только та часть механики, которой в эффектах ещё нет", async () => {
    const effects = { charBonuses: [{ stat: "s", value: 2 }], fearRating: 1 };
    const item = itemDoc({ effects, fx: [{ name: "Страх", system: { changes:
      [{ key: "system.fearRating", type: "upgrade", value: 1, phase: "final", priority: 0 }] } }] });

    expect(await migrateItemEffects(item)).toBe(true);

    // Бонус Силы приехал, Рейтинг Страха вторым источником не стал.
    expect(changesOf(item).map(c => c.key))
      .toEqual(["system.fearRating", "system.characteristics.s.bonusFx"]);
  });

  it("AP против типа урона переносится в absorption.vsType", async () => {
    const item = itemDoc({ type: "armorMod", name: "Дефлективная",
                           effects: { apVsRending: 2, apVsBlast: 2 } });

    expect(await migrateItemEffects(item)).toBe(true);

    expect(changesOf(item).map(c => c.key))
      .toEqual(["system.absorption.vsType.rending", "system.absorption.vsType.blast"]);
  });

  it("модификация с полями мимо ActiveEffect перенесённой не помечается", async () => {
    // Потолок Ловкости не считает никто: ни у эффектов такого ключа нет, ни
    // system.maxAgility брони actor.mjs не читает (wdbc-fde). Пометить —
    // значит закрыть последний путь, старое поле.
    const item = itemDoc({ type: "armorMod", name: "Открытые Сочленения",
                           effects: { maxAgilityMod: 10 } });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBeUndefined();
  });

  it("AP модификации брони в эффект не уезжает", async () => {
    // Он складывается в AP своего носителя ДО сравнения броней между собой и
    // обвешан гейтами (снятый шлем, тип брони) — считает только
    // getArmorModEffects, значит старое поле должно остаться читаемым.
    const item = itemDoc({ type: "armorMod", name: "Аблативная", effects: { apAll: 5 } });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.effects).toEqual([]);
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBeUndefined();
  });

  it("чужой эффект на другое поле за перенос не принимается", async () => {
    const item = itemDoc({ effects: CHAR_BONUS, fx: [{ name: "Ручной эффект", system: { changes:
      [{ key: "system.speed", type: "add", value: 1, phase: "final", priority: 0 }] } }] });

    expect(await migrateItemEffects(item)).toBe(true);

    expect(item.effects).toHaveLength(2);
    expect(changesOf(item).slice(1)).toEqual(legacyEffectsToChanges(CHAR_BONUS));
  });

  it("неустановленный имплант получает эффект выключенным", async () => {
    // Старый расчёт органы без флага installed пропускал (documents/actor.mjs).
    const off = itemDoc({ type: "implant", effects: CHAR_BONUS });
    const on  = itemDoc({ type: "implant", effects: CHAR_BONUS, flags: { installed: true } });

    await migrateItemEffects(off);
    await migrateItemEffects(on);

    expect(off.effects[0].disabled).toBe(true);
    expect(on.effects[0].disabled).toBe(false);
  });

  it("предмету без старой механики ставится флаг, эффект не создаётся", async () => {
    const item = itemDoc({ effects: { charBonuses: [], armourAll: 0 } });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.effects).toEqual([]);
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBe(true);
  });

  it("уже перенесённому предмету без флага флаг доставляется", async () => {
    // Иначе актор сложит старое поле поверх эффекта — тот же бонус дважды.
    const item = itemDoc({ effects: CHAR_BONUS, fx: [{ name: "Черта (перенесено)",
      system: { changes: legacyEffectsToChanges(CHAR_BONUS) } }] });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBe(true);
  });

  it("тип вне списка не трогается вовсе", async () => {
    const item = itemDoc({ type: "weapon", effects: { armourAll: 2 } });

    expect(await migrateItemEffects(item)).toBe(false);

    expect(item.effects).toEqual([]);
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBeUndefined();
  });
});

describe("починка ключа характеристики .value → .total", () => {
  it("правит неработавший ключ и второй раз ничего не делает", async () => {
    const item = itemDoc({ fx: [{ name: "Черта (перенесено)", system: { changes: [
      { key: "system.characteristics.t.value", type: "add", value: 3, phase: "final", priority: 0 },
      { key: "system.armorBonus.head", type: "add", value: 1, phase: "initial", priority: 0 }
    ] } }] });

    expect(await repairCharValueEffectKeys(item)).toBe(1);
    expect(changesOf(item)[0].key).toBe("system.characteristics.t.total");
    expect(changesOf(item)[1].key).toBe("system.armorBonus.head");

    expect(await repairCharValueEffectKeys(item)).toBe(0);
  });
});

// Ранняя миграция целилась в system.armour.<зона> — поля с таким именем у
// актора нет (в схеме system.armor, и это ручной блок через Math.max). AP всех
// перенесённых предметов был мёртв: старое поле актор у помеченного не читает,
// а эффект писал в никуда.
// Ранняя миграция (и Конструктор) целились в system.characteristics.<k>.bonus.
// Это поле СЧИТАЕТСЯ расчётом листа, и эффект фазы "final" ложился поверх
// готового числа: на листе Бонус менялся, а до брони, навыков и перемещений не
// доходил (wdbc-5wm). Цель — хранимое .bonusFx в фазе "initial"; у миров, где
// миграция уже прошла, ключ надо починить, иначе рядом ляжет второй эффект.
describe("починка ключей характеристики → надбавки bonusFx/totalFx", () => {
  it("правит оба ключа, ставит фазу initial и второй раз ничего не делает", async () => {
    const item = itemDoc({ fx: [{ name: "Черта (перенесено)", system: { changes: [
      { key: "system.characteristics.t.bonus", type: "add", value: 2, phase: "final", priority: 0 },
      { key: "system.characteristics.s.total", type: "add", value: 3, phase: "final", priority: 0 }
    ] } }] });

    expect(await repairCharBonusEffectKeys(item)).toBe(1);
    expect(changesOf(item)[0]).toMatchObject({
      key: "system.characteristics.t.bonusFx", phase: "initial", value: 2
    });
    // Значение чинится по той же причине: «считается заново каждый проход»
    // означает лишь, что эффект не затирается. Ложится он ПОСЛЕ расчёта, и
    // Бонус с навыками выведены из старого значения — до них не доходило.
    expect(changesOf(item)[1]).toMatchObject({
      key: "system.characteristics.s.totalFx", phase: "initial"
    });

    expect(await repairCharBonusEffectKeys(item)).toBe(0);
  });
});

describe("починка мёртвого ключа брони", () => {
  const deadFx = (name, ...locs) => ({ name, system: { changes: locs.map(loc =>
    ({ key: `system.armour.${loc}`, type: "add", value: 2, phase: "final", priority: 0 })) } });

  it("черте ключ переводится на armorBonus и в фазу initial", async () => {
    const item = itemDoc({ type: "trait", name: "Естественная Броня",
                           effects: { armourAll: 2 }, flags: { migratedEffect: true },
                           fx: [deadFx("Естественная Броня (перенесено)", "head", "body")] });

    expect(await repairDeadArmourKeys(item)).toBe(1);

    expect(changesOf(item).map(c => c.key))
      .toEqual(["system.armorBonus.head", "system.armorBonus.body"]);
    expect(changesOf(item).every(c => c.phase === "initial")).toBe(true);
    // Флаг остаётся: механику ведёт эффект, старое поле читать по-прежнему нельзя.
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBe(true);

    expect(await repairDeadArmourKeys(item)).toBe(0);
  });

  it("модификации брони эффект снимается, а флаг гасится", async () => {
    // AP модификации складывается в AP её носителя ДО того, как брони
    // сравниваются между собой (armorFromItems в actor.mjs), и обвешана
    // гейтами снятого шлема и типа брони. Актору её отдавать нельзя — считает
    // только getArmorModEffects, значит поле должно снова стать видимым.
    const item = itemDoc({ type: "armorMod", name: "Аблативная",
                           effects: { apAll: 5 }, flags: { migratedEffect: true },
                           fx: [deadFx("Аблативная (перенесено)", "head", "body")] });

    expect(await repairDeadArmourKeys(item)).toBe(1);

    expect(item.effects).toEqual([]);
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBeUndefined();
  });

  it("часть эффекта с другой механикой переживает починку", async () => {
    // Крукс Механикус: бонус S/T работал, AP был мёртв — снять надо только AP.
    const item = itemDoc({ type: "implant", name: "Крукс Механикус",
      effects: { charBonuses: [{ stat: "s", value: 2 }], armourAll: 2 },
      flags: { migratedEffect: true },
      fx: [{ name: "Крукс Механикус (перенесено)", system: { changes: [
        { key: "system.characteristics.s.bonus", type: "add", value: 2, phase: "final", priority: 0 },
        { key: "system.armour.head", type: "add", value: 2, phase: "final", priority: 0 }
      ] } }] });

    expect(await repairDeadArmourKeys(item)).toBe(1);

    expect(changesOf(item).map(c => c.key))
      .toEqual(["system.characteristics.s.bonus", "system.armorBonus.head"]);
  });

  it("модификация с рабочим AP против типа урона под починку не попадает", async () => {
    const item = itemDoc({ type: "armorMod", name: "Керамит",
      effects: { apVsEnergy: 3 }, flags: { migratedEffect: true },
      fx: [{ name: "Керамит (перенесено)", system: { changes: [
        { key: "system.absorption.vsType.energy", type: "add", value: 3, phase: "final", priority: 0 }
      ] } }] });

    expect(await repairDeadArmourKeys(item)).toBe(0);

    expect(item.effects).toHaveLength(1);
    expect(item.getFlag("warhammer-dbc", "migratedEffect")).toBe(true);
  });
});

// Ранняя миграция перенесла в эффект механику, которую потом завели и в
// Конструкторе (либо наоборот) — так в паке оказались 13 Родных миров. На
// акторе работают оба источника: эффект приезжает с предметом, а Конструктор
// заводит свой при получении предмета — бонус удваивается. Побеждает
// Конструктор: он и есть штатное место механики, эффект «(перенесено)» — след
// миграции.
// Пересборка эффектов (wdbc-473) узнаёт свои по метке mechEntry. У живых миров
// эффекты Конструктора её не несут: их завела прежняя разовая выдача. Без метки
// первая же правка завела бы рядом второй эффект — бонус дважды.
describe("пометка эффектов Конструктора", () => {
  const mech = [{ id: "g1", operator: "AND", entries: [
    { id: "e1", kind: "characteristic", charKey: "t", field: "bonus", op: "add", value: 2 }] }];

  it("эффект с именем записи получает её метку, второй раз ничего не делает", async () => {
    const name = describeMechEntry(mech[0].entries[0]);
    const item = itemDoc({ flags: { mechanics: mech }, fx: [{ name, system: { changes: [
      { key: "system.characteristics.t.bonusFx", type: "add", value: 2, phase: "initial", priority: 0 }] } }] });

    expect(await adoptMechanicsEffects(item)).toBe(1);
    expect(item.effects[0].getFlag("warhammer-dbc", "mechEntry")).toBe("e1");

    expect(await adoptMechanicsEffects(item)).toBe(0);
  });

  it("чужой эффект метки не получает", async () => {
    const item = itemDoc({ flags: { mechanics: mech }, fx: [{ name: "Ручной ГМа", system: { changes: [
      { key: "system.fearRating", type: "upgrade", value: 2, phase: "final", priority: 0 }] } }] });

    expect(await adoptMechanicsEffects(item)).toBe(0);
  });
});

describe("снятие механики, задвоенной Конструктором", () => {
  /** Группа Конструктора с записями характеристик — как в packs-src. */
  const mechanics = (...entries) => [{ id: "g1", operator: "AND",
    entries: entries.map(([charKey, value], i) => ({ id: `e${i}`, kind: "characteristic",
      charKey, field: "total", op: "add", value })) }];

  const migrated = (name, ...keys) => ({ name: `${name} (перенесено)`, system: {
    changes: keys.map(key => ({ key, type: "add", value: 3, phase: "final", priority: 0 })) } });

  // Запись «Бонус» Конструктора целится в .bonusFx (wdbc-5wm), а перенос легаси —
  // туда же. Если снятие дублей строит ключ своей копией кода, оно перестаёт
  // узнавать такую пару, и бонус считается дважды.
  it("надбавка к Бонусу от Конструктора узнаётся в перенесённом эффекте", async () => {
    const item = itemDoc({ type: "trait", name: "Могучий",
      flags: { mechanics: [{ id: "g1", operator: "AND", entries: [
        { id: "e0", kind: "characteristic", charKey: "s", field: "bonus", op: "add", value: 2 }] }] },
      fx: [migrated("Могучий", "system.characteristics.s.bonusFx")] });

    expect(await dropMechanicsDuplicates(item)).toBe(1);
    expect(item.effects).toEqual([]);
  });

  it("перенесённый эффект, чью механику ведёт Конструктор, снимается целиком", async () => {
    const item = itemDoc({ type: "homeworld", name: "Добывающий мир",
      flags: { mechanics: mechanics(["s", 3], ["t", 3], ["fel", -3]) },
      fx: [migrated("Добывающий", "system.characteristics.s.totalFx",
        "system.characteristics.t.totalFx", "system.characteristics.fel.totalFx")] });

    expect(await dropMechanicsDuplicates(item)).toBe(3);
    expect(item.effects).toEqual([]);
  });

  it("часть, которой в Конструкторе нет, остаётся", async () => {
    const item = itemDoc({ type: "trait", name: "Черта",
      flags: { mechanics: mechanics(["s", 3]) },
      fx: [migrated("Черта", "system.characteristics.s.totalFx", "system.size")] });

    expect(await dropMechanicsDuplicates(item)).toBe(1);
    expect(changesOf(item).map(c => c.key)).toEqual(["system.size"]);
  });

  it("эффекты самого Конструктора не трогает", async () => {
    // Их он завёл на те же ключи — по ключу дубль от источника не отличить,
    // отличает имя: «(перенесено)» пишет только миграция (applyMechEntry
    // называет свои через describeMechEntry).
    const item = itemDoc({ type: "homeworld", name: "Мир-улей",
      flags: { mechanics: mechanics(["wp", 3]), mechanicsApplied: true },
      fx: [{ name: "Сила Воли: + 3", system: { changes:
        [{ key: "system.characteristics.wp.total", type: "add", value: 3, phase: "final", priority: 0 }] } }] });

    expect(await dropMechanicsDuplicates(item)).toBe(0);
    expect(changesOf(item)).toHaveLength(1);
  });

  it("у предмета без Конструктора ничего не снимает", async () => {
    // Предмет мог попасть к актору до того, как механику завели в Конструкторе:
    // его копия своих записей не получит, и эффект — единственный источник.
    const item = itemDoc({ type: "homeworld", name: "Добывающий мир",
      fx: [migrated("Добывающий", "system.characteristics.s.total")] });

    expect(await dropMechanicsDuplicates(item)).toBe(0);
    expect(changesOf(item)).toHaveLength(1);
  });
});

describe("миграция мира", () => {
  it("проходит по предметам акторов и считает перенесённые", async () => {
    const legacy  = itemDoc({ name: "Аморфный", effects: { sizeMod: 1 } });
    const foreign = itemDoc({ type: "weapon", name: "Меч" });
    globalThis.game.actors = [{ name: "Персонаж", items: [legacy, foreign] }];

    const { migrated } = await migrateAllItemEffects();

    expect(migrated).toBe(1);
    expect(changesOf(legacy)).toEqual(legacyEffectsToChanges({ sizeMod: 1 }));
    expect(foreign.effects).toEqual([]);
  });

  it("чинит ключ ранней миграции до переноса, а не после", async () => {
    // Иначе перенос не узнает свой же эффект (ищет `.total`, а лежит `.value`)
    // и положит рядом второй — тот же бонус дважды.
    const effects = { charValueBonuses: [{ stat: "s", value: 2 }] };
    const item = itemDoc({ effects, flags: { migratedEffect: true },
      fx: [{ name: "Черта (перенесено)", system: { changes:
        [{ key: "system.characteristics.s.value", type: "add", value: 2, phase: "final", priority: 0 }] } }] });
    globalThis.game.actors = [{ name: "Персонаж", items: [item] }];

    const { migrated, repaired } = await migrateAllItemEffects();

    // Починок две: ключ (.value → .total) и цель (.total → хранимое .totalFx).
    expect([migrated, repaired]).toEqual([0, 2]);
    expect(changesOf(item)).toEqual(legacyEffectsToChanges(effects));
  });

  it("снимает задвоенный Конструктором эффект и не заводит его заново", async () => {
    // Старое поле у таких предметов заполнено той же механикой, поэтому снятый
    // эффект перенос мог бы восстановить — не должен: записи Конструктора он
    // считает уже несомой механикой (carriedKeys).
    const item = itemDoc({ type: "homeworld", name: "Добывающий мир",
      effects: { charValueBonuses: [{ stat: "s", value: 3 }] },
      flags: { migratedEffect: true, mechanics: [{ id: "g1", operator: "AND", entries:
        [{ id: "e0", kind: "characteristic", charKey: "s", field: "total", op: "add", value: 3 }] }] },
      fx: [{ name: "Добывающий (перенесено)", system: { changes:
        [{ key: "system.characteristics.s.total", type: "add", value: 3, phase: "final", priority: 0 }] } }] });
    globalThis.game.actors = [{ name: "Персонаж", items: [item] }];

    const { migrated, deduped } = await migrateAllItemEffects();

    expect([migrated, deduped]).toEqual([0, 1]);
    expect(item.effects).toEqual([]);
  });

  /** Пак-заглушка: пишет в `lock` каждую смену замка. */
  function packStub(lock, { locked = true, getDocuments = async () => [] } = {}) {
    return { locked, getDocuments,
             configure: async ({ locked: l }) => { lock.push(l); } };
  }

  it("проходит по компендиумам библиотек, разблокировав пак и вернув замок", async () => {
    const doc  = itemDoc({ name: "Мир-улей", effects: { charValueBonuses: [{ stat: "wp", value: 3 }] } });
    const lock = [];
    globalThis.game.packs = new Map([["warhammer-dbc.homeworlds",
      packStub(lock, { getDocuments: async () => [doc] })]]);

    const { migrated } = await migrateAllItemEffects();

    expect(migrated).toBe(1);
    expect(changesOf(doc)).toEqual(legacyEffectsToChanges({ charValueBonuses: [{ stat: "wp", value: 3 }] }));
    // Замок снят на время обхода и возвращён: иначе пак остаётся открытым на
    // правку мимо настройки protectCompendiumEdits — до конца жизни мира.
    expect(lock).toEqual([false, true]);
  });

  it("замок возвращается и когда пак упал посреди обхода", async () => {
    const lock = [];
    globalThis.game.packs = new Map([["warhammer-dbc.homeworlds",
      packStub(lock, { getDocuments: async () => { throw new Error("пак недоступен"); } })]]);

    await migrateAllItemEffects();

    expect(lock).toEqual([false, true]);
  });

  it("пак, открытый ГМом до миграции, остаётся открытым", async () => {
    const lock = [];
    globalThis.game.packs = new Map([["warhammer-dbc.homeworlds", packStub(lock, { locked: false })]]);

    await migrateAllItemEffects();

    expect(lock).toEqual([]);
  });
});

describe("предметы packs-src", () => {
  /** Все документы packs-src. */
  function allPackDocs() {
    const out = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".json")) continue;
        out.push(JSON.parse(fs.readFileSync(full, "utf8")));
      }
    };
    walk(PACKS_SRC);
    return out;
  }

  /**
   * Из них — мигрируемых типов и со старой механикой, которую есть куда
   * переносить. Предмет с полем из legacyOnlyKeys миграция обходит целиком
   * (AP модификации, потолок Ловкости) — за него отвечает отдельная проверка
   * ниже, что он и не помечен перенесённым.
   */
  const legacyPackDocs = () => allPackDocs().filter(doc =>
    MIGRATE_EFFECT_TYPES.has(doc.type)
    && legacyEffectsToChanges(doc.system?.effects ?? {}).length
    && !legacyOnlyKeys(doc).some(k => doc.system?.effects?.[k]));

  /** Предмет пака как документ: те же эффекты, флаги и старое поле. */
  const packItem = doc => itemDoc({
    type: doc.type, name: doc.name, effects: doc.system.effects,
    flags: doc.flags?.["warhammer-dbc"] ?? {},
    fx: doc.effects ?? []
  });

  const docs = legacyPackDocs();

  it("в паках есть предметы со старой механикой — миграции есть что переносить", () => {
    expect(docs.length).toBeGreaterThan(0);
  });

  it("механика каждого предмета оказывается в эффектах, и лишнего источника не появляется", async () => {
    // Источники ключа — эффекты предмета и записи Конструктора (свои эффекты он
    // заводит при получении предмета актором). После миграции у каждого ключа
    // старой механики источник должен быть; там, где он уже был, число не
    // меняется — переносу там делать нечего. Двойной источник у 13 Родных миров
    // приехал вместе с паком и разбирается отдельно (wdbc-43d).
    const count = (keys, key) => keys.filter(k => k === key).length;

    for (const doc of docs) {
      const item = packItem(doc);
      const want = legacyEffectsToChanges(doc.system.effects);
      const before = changesOf(item).map(c => c.key).concat(mechanicsKeys(doc));

      await migrateItemEffects(item);

      const after = changesOf(item).map(c => c.key).concat(mechanicsKeys(doc));
      for (const { key } of want) {
        const was = count(before, key);
        expect(count(after, key), `${doc.name}: ${key}`).toBe(was || 1);
      }
    }
  });

  it("ни один предмет пака не правит характеристику из двух источников", async () => {
    // Иначе на акторе сложатся оба: эффект приезжает с предметом, записи
    // Конструктора он отыгрывает сам при получении (wdbc-43d — 13 Родных миров).
    const doubled = [];
    for (const doc of allPackDocs()) {
      const mech = new Set(mechanicsKeys(doc));
      const both = (doc.effects ?? []).flatMap(f => f.system?.changes ?? [])
        .map(c => c.key).filter(k => mech.has(k));
      if (both.length) doubled.push(`${doc.name}: ${[...new Set(both)].join(", ")}`);
    }
    expect(doubled).toEqual([]);
  });

  it("ни одна модификация брони не осталась с мёртвым AP против типа урона", async () => {
    // Помеченный перенесённым мод старое поле теряет: combat/armor-mods.mjs
    // читает его только у непомеченных. Значит у каждого apVs* в паке должен
    // быть свой эффект — иначе Керамит и Дефлективная не дают ничего (wdbc-1j8).
    const dead = [];
    for (const doc of allPackDocs()) {
      if (doc.type !== "armorMod" || !doc.flags?.["warhammer-dbc"]?.migratedEffect) continue;
      const keys = new Set(legacyEffectsToChanges(doc.system?.effects ?? {}).map(c => c.key));
      if (!keys.size) continue;
      for (const c of (doc.effects ?? []).flatMap(f => f.system?.changes ?? [])) keys.delete(c.key);
      if (keys.size) dead.push(`${doc.name}: ${[...keys].join(", ")}`);
    }
    expect(dead).toEqual([]);
  });

  it("ни один предмет пака не помечен перенесённым с полем мимо ActiveEffect", async () => {
    // Пометка велит актору старое поле не читать, а переносить такое поле
    // некуда — механика пропадает с обеих сторон. Миграция пометить не даст
    // (LEGACY_ONLY_KEYS), но прошлая версия успела: так стояли «Открытые
    // Сочленения» с потолком Ловкости (wdbc-1j8, ждёт wdbc-fde).
    const stuck = allPackDocs()
      .filter(doc => doc.flags?.["warhammer-dbc"]?.migratedEffect
                  && legacyOnlyKeys(doc).some(k => doc.system?.effects?.[k]))
      .map(doc => doc.name);
    expect(stuck).toEqual([]);
  });

  it("мёртвого ключа system.armour.* в паках не осталось", async () => {
    const dead = [];
    for (const doc of allPackDocs())
      for (const c of (doc.effects ?? []).flatMap(f => f.system?.changes ?? []))
        if (c.key?.startsWith("system.armour.")) dead.push(`${doc.name}: ${c.key}`);
    expect(dead).toEqual([]);
  });

  it("предмет с механикой Конструктора миграция не трогает", async () => {
    const byBuilder = docs.filter(d => mechanicsKeys(d).length);
    expect(byBuilder.length).toBeGreaterThan(0);

    for (const doc of byBuilder) {
      const item = packItem(doc);
      expect(await migrateItemEffects(item), doc.name).toBe(false);
    }
  });

  /** Ключи характеристик, которые правит Конструктор этого предмета (как в applyMechEntry). */
  // Ключ строит та же функция, что и Конструктор: своя копия правила здесь
  // разошлась бы с ним молча — так и вышло, когда цель уехала на надбавки
  // bonusFx/totalFx, а тест продолжал ждать .bonus/.total.
  function mechanicsKeys(doc) {
    return (doc.flags?.["warhammer-dbc"]?.mechanics ?? [])
      .flatMap(g => g.entries ?? [])
      .filter(e => e.kind === "characteristic")
      .map(characteristicEffectKey);
  }
});
