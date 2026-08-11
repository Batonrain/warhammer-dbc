// test/data/item-schemas.test.mjs
//
// Перевод типа предмета с template.json на схему проверяется двумя вопросами.
//
// 1. Умолчания. Новый предмет должен получать ровно те значения, что раздавал
//    template.json: схема, поменявшая умолчание, тихо меняет содержимое всех
//    создаваемых предметов.
// 2. Сохранность. Документ из packs-src должен пройти через схему без потерь:
//    поле, забытое в defineSchema, у Foundry не сохранится, и данные книги
//    исчезнут при первой же правке предмета в игре.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { ITEM_DATA_MODELS } from "../../module/data/index.mjs";

/**
 * По типу: папка packs-src с его документами, умолчания прежнего template.json
 * и пути, которые схема хранить не обязана.
 *
 * `migratedAway` — поля прошлого формата: их значение не теряется, а переезжает
 * в другое поле силами `migrateData`, и проверяет этот переезд отдельный тест.
 */
const TYPES = {
  weaponProperty: {
    pack: "weapon-properties",
    defaults: {
      description: "", reminder: "", category: "both",
      hasRating: false, hasRating2: false, autoKey: "", bookSource: ""
    }
  },
  aspiration: {
    pack: "aspirations",
    defaults: { key: "", table: "pride", n: 0, mods: "", description: "", bookSource: "" }
  },
  trait: {
    pack: "traits",
    // К умолчаниям template.json добавлено `requirement` (поле лежит в данных
    // пака и читается листом предмета, а в template.json объявлено не было).
    defaults: {
      description: "", notes: "", benefit: "", source: "", bookSource: "", requirement: "",
      hasRating: false, rating: 0, hasRating2: false, rating2: 0,
      effects: {
        charBonuses: [], charValueBonuses: [],
        armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0
      }
    },
    migratedAway: ["effects.charBonusStat", "effects.charBonusValue"]
  }
};

const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");

/** Документы пака: по файлу на предмет, папки — это папки компендиума. */
function packDocuments(pack, type) {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".json") || entry.name.startsWith("_")) continue;
      const doc = JSON.parse(fs.readFileSync(full, "utf8"));
      if (doc.type === type) out.push({ file: path.relative(PACKS_SRC, full), doc });
    }
  };
  walk(path.join(PACKS_SRC, pack));
  return out;
}

/** Значения по путям: «effects.sizeMod» → 1. Массивы сравниваются целиком. */
function leaves(value, prefix = "") {
  if (Array.isArray(value)) return [[prefix, JSON.stringify(value)]];
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, v]) => leaves(v, prefix ? `${prefix}.${key}` : key));
  return [[prefix, value]];
}

/** Пусто — значит терять нечего: пустая строка, пустой список, пустой объект. */
function isEmpty(value) {
  return value === "" || value === "[]" || value === "{}" || value === undefined;
}

describe("типы данных предметов", () => {
  it("переведены ровно те типы, что перечислены в тесте", () => {
    expect(Object.keys(ITEM_DATA_MODELS).sort()).toEqual(Object.keys(TYPES).sort());
  });

  for (const [type, { pack, defaults, migratedAway = [] }] of Object.entries(TYPES)) {
    describe(type, () => {
      const Model = ITEM_DATA_MODELS[type];

      it("пустой предмет получает умолчания прежнего template.json", () => {
        expect(new Model({}).toObject()).toEqual(defaults);
      });

      it("документы пака проходят через схему без потерь", () => {
        const docs = packDocuments(pack, type);
        expect(docs.length).toBeGreaterThan(0);

        const lost = [];
        for (const { file, doc } of docs) {
          const after = new Map(leaves(new Model(doc.system).toObject()));
          for (const [key, value] of leaves(doc.system)) {
            if (isEmpty(value) || migratedAway.includes(key)) continue;
            if (after.get(key) !== value) lost.push(`${file}: ${key} = ${JSON.stringify(value)}`);
          }
        }
        expect(lost).toEqual([]);
      });
    });
  }
});
