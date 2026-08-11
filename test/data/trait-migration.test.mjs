// test/data/trait-migration.test.mjs
//
// Одиночный бонус к Бонусу характеристики раньше лежал двумя полями
// (`effects.charBonusStat` + `effects.charBonusValue`), позже тот же бонус стал
// записываться списком `effects.charBonuses`. Схема Черты сводит формат к
// одному — списку, — и проверяется это на настоящих данных пака: в
// packs-src/traits такие Черты есть.
//
// Главная проверка — не форма записи, а равенство результата: перенос механики
// в ActiveEffect (constants/effect-keys.mjs) должен дать те же changes до и
// после миграции. Иначе у существующих персонажей поедут характеристики.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { TraitData }              from "../../module/data/item/trait.mjs";
import { legacyEffectsToChanges } from "../../module/constants/effect-keys.mjs";

const TRAITS_SRC = path.resolve(import.meta.dirname, "../../packs-src/traits");

/** Черты пака, записанные в прошлом формате. */
function legacyTraits() {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".json")) continue;
      const doc = JSON.parse(fs.readFileSync(full, "utf8"));
      if (doc.type === "trait" && doc.system?.effects?.charBonusStat) out.push(doc);
    }
  };
  walk(TRAITS_SRC);
  return out;
}

describe("миграция Черты: одиночный бонус → список", () => {
  const docs = legacyTraits();

  it("в паке есть Черты прошлого формата — миграции есть что чинить", () => {
    expect(docs.length).toBeGreaterThan(0);
  });

  it("бонус переезжает в список, старых полей не остаётся", () => {
    for (const doc of docs) {
      const { effects } = new TraitData(doc.system).toObject();
      expect(effects.charBonuses, doc.name).toContainEqual({
        stat: doc.system.effects.charBonusStat,
        value: doc.system.effects.charBonusValue
      });
      expect(effects.charBonusStat, doc.name).toBeUndefined();
      expect(effects.charBonusValue, doc.name).toBeUndefined();
    }
  });

  it("перенос в ActiveEffect даёт те же changes до и после миграции", () => {
    for (const doc of docs) {
      const { effects } = new TraitData(doc.system).toObject();
      expect(legacyEffectsToChanges(effects), doc.name)
        .toEqual(legacyEffectsToChanges(doc.system.effects));
    }
  });

  it("уже переведённая Черта миграцию проходит без изменений", () => {
    const migrated = { effects: { charBonuses: [{ stat: "s", value: 4 }] } };
    expect(new TraitData(migrated).toObject().effects.charBonuses)
      .toEqual([{ stat: "s", value: 4 }]);
  });

  it("оба формата в одной Черте не теряют друг друга", () => {
    const mixed = {
      effects: { charBonusStat: "t", charBonusValue: 2, charBonuses: [{ stat: "s", value: 4 }] }
    };
    expect(new TraitData(mixed).toObject().effects.charBonuses)
      .toEqual([{ stat: "s", value: 4 }, { stat: "t", value: 2 }]);
  });

  it("пустой одиночный бонус в список не попадает", () => {
    // Умолчаниями схемы заполняется только отсутствующий `effects` целиком,
    // поэтому у частично заполненного объекта списка может не быть вовсе —
    // так же, как было с template.json. Читатели механики к этому готовы
    // (`effects.charBonuses ?? []` в effect-keys.mjs).
    const { effects } = new TraitData({ effects: { charBonusStat: "", charBonusValue: 0 } }).toObject();
    expect(effects.charBonuses ?? []).toEqual([]);
    expect(effects.charBonusStat).toBeUndefined();
    expect(effects.charBonusValue).toBeUndefined();
  });
});
