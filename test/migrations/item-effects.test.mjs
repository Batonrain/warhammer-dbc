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
import { migrateItemEffects, repairCharValueEffectKeys, migrateAllItemEffects,
         MIGRATE_EFFECT_TYPES } from "../../module/migrations/item-effects.mjs";

const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");
const CHAR_BONUS = { charBonuses: [{ stat: "s", value: 2 }] };

/** Предмет-заглушка: флаги, список эффектов и запись новых — больше миграции нечего. */
function itemDoc({ type = "trait", name = "Черта", effects = {},
                   flags = {}, fx = [], system = {} } = {}) {
  const own = { ...flags };
  const doc = {
    id: "item-1", type, name, img: "icons/svg/aura.svg",
    system: { effects, ...system },
    effects: fx.map(f => {
      const effect = structuredClone(f);
      // Починка правит только этот ключ — больше заглушке знать нечего.
      effect.update = async data => { effect.system.changes = data["system.changes"]; return effect; };
      return effect;
    }),
    getFlag: (_scope, key) => own[key],
    setFlag: async (_scope, key, value) => { own[key] = value; return value; },
    createEmbeddedDocuments: async (_type, docs) => {
      doc.effects.push(...docs.map(d => structuredClone(d)));
      return docs;
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
      .toEqual(["system.fearRating", "system.characteristics.s.bonus"]);
  });

  it("модификация с полями мимо ActiveEffect перенесённой не помечается", async () => {
    // AP против типа урона считает combat/armor-mods.mjs по старому полю и
    // гасит его по этому же флагу: пометить — значит потерять механику.
    const item = itemDoc({ type: "armorMod", name: "Дефлективная",
                           effects: { apVsRending: 2, apVsBlast: 2 } });

    expect(await migrateItemEffects(item)).toBe(false);

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
      { key: "system.armour.head", type: "add", value: 1, phase: "final", priority: 0 }
    ] } }] });

    expect(await repairCharValueEffectKeys(item)).toBe(1);
    expect(changesOf(item)[0].key).toBe("system.characteristics.t.total");
    expect(changesOf(item)[1].key).toBe("system.armour.head");

    expect(await repairCharValueEffectKeys(item)).toBe(0);
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

    expect([migrated, repaired]).toEqual([0, 1]);
    expect(changesOf(item)).toEqual(legacyEffectsToChanges(effects));
  });

  it("проходит по компендиумам библиотек, разблокировав пак", async () => {
    const doc  = itemDoc({ name: "Мир-улей", effects: { charValueBonuses: [{ stat: "wp", value: 3 }] } });
    const lock = [];
    globalThis.game.packs = new Map([["warhammer-dbc.homeworlds", {
      locked: true,
      configure: async ({ locked }) => { lock.push(locked); },
      getDocuments: async () => [doc]
    }]]);

    const { migrated } = await migrateAllItemEffects();

    expect(migrated).toBe(1);
    expect(changesOf(doc)).toEqual(legacyEffectsToChanges({ charValueBonuses: [{ stat: "wp", value: 3 }] }));
    expect(lock[0]).toBe(false);
  });
});

describe("предметы packs-src", () => {
  /** Документы паков мигрируемых типов, у которых есть старая механика. */
  function legacyPackDocs() {
    const out = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".json")) continue;
        const doc = JSON.parse(fs.readFileSync(full, "utf8"));
        if (!MIGRATE_EFFECT_TYPES.has(doc.type)) continue;
        if (!legacyEffectsToChanges(doc.system?.effects ?? {}).length) continue;
        out.push(doc);
      }
    };
    walk(PACKS_SRC);
    return out;
  }

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

  it("предмет с механикой Конструктора миграция не трогает", async () => {
    const byBuilder = docs.filter(d => mechanicsKeys(d).length);
    expect(byBuilder.length).toBeGreaterThan(0);

    for (const doc of byBuilder) {
      const item = packItem(doc);
      expect(await migrateItemEffects(item), doc.name).toBe(false);
    }
  });

  /** Ключи характеристик, которые правит Конструктор этого предмета (как в applyMechEntry). */
  function mechanicsKeys(doc) {
    return (doc.flags?.["warhammer-dbc"]?.mechanics ?? [])
      .flatMap(g => g.entries ?? [])
      .filter(e => e.kind === "characteristic")
      .map(e => `system.characteristics.${e.charKey}.${e.field}`);
  }
});
