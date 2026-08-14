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
  },

  // ── Снаряжение и модификации (wdbc-ff4.1.1) ────────────────────────────────
  gear: {
    pack: "gear",
    defaults: {
      description: "", notes: "", quantity: 1, weight: 0, availability: 0,
      quality: "common", gearCategory: "misc", linkedWeapon: "", worn: "",
      effect: "", reminder: "", qualityEffects: { poor: "", good: "", best: "" },
      isRig: false, rig: { comfort: "normal", backSlot: false, slots: [], magLocks: [] },
      itemSize: "", bonuses: [], drukhari: false, bookSource: "",
      // В template.json объявлено не было, но лежит у 20 предметов пака —
      // след раскладки по папкам компендиума при импорте. Кодом не читается;
      // объявлено, чтобы правка предмета в игре его не стирала.
      folderPath: []
    }
  },
  tool: {
    pack: "tools",
    defaults: {
      description: "", notes: "", quantity: 1, weight: 0, availability: 0,
      quality: "common", toolCategory: "general", linkedWeapon: "", effect: "",
      reminder: "", qualityEffects: { poor: "", good: "", best: "" },
      bonuses: [], drukhari: false
    }
  },
  cybernetic: {
    // Предметов этого типа в паках нет — сохранять нечего, проверяются
    // только умолчания.
    pack: null,
    defaults: {
      description: "", notes: "", installed: "", linkedWeapon: "",
      quality: "common", availability: 0, weight: 0
    }
  },
  implant: {
    pack: "implants",
    defaults: {
      description: "", notes: "", category: "mechanicus", quality: "common",
      effect: "", installed: "", geneSeedOrder: 0, linkedWeapon: "", bookSource: "",
      effects: {
        charBonuses: [], charValueBonuses: [], armourAll: 0,
        apHead: 0, apBody: 0, apArms: 0, apLegs: 0,
        fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0
      },
      shield: {
        enabled: false, shieldNature: "technological", shieldType: "deflector",
        ratingMin: 1, ratingMax: 10, overloadThreshold: 0, isSpecialRating: false,
        currentRating: 0, equipped: false, status: "inactive"
      },
      // Свойства встроенного оружия импланта — правятся на листе предмета
      // (item-sheet.mjs), а в template.json объявлены не были.
      weaponProps: []
    },
    migratedAway: ["effects.charBonusStat", "effects.charBonusValue"]
  },
  weaponMod: {
    pack: "weapon-mods",
    defaults: {
      description: "", notes: "", category: "ranged", modGroup: "other",
      requirement: "", installedOn: "", weight: 0, availability: 0, quality: "common",
      effects: {
        attackMod: 0, damageMod: 0, penMod: 0, rangeMod: 0, rangeMult: 1,
        clipMod: 0, clipMult: 1, rofSemiMod: 0, rofFullMod: 0, reliabilityMod: 0,
        balanceMod: 0, weightPct: 0,
        addProps: [], removeProps: [], mechAddProps: [], mechRemoveProps: []
      },
      drukhari: false
    }
  },
  armorMod: {
    // Модификации брони лежат в двух паках: обычные и Системы силовой брони.
    pack: ["armor-mods", "armour-systems"],
    defaults: {
      description: "", notes: "", category: "armor", modGroup: "general",
      requirement: "", installedOn: "", weight: 0, availability: 0, quality: "common",
      activatable: false, active: false,
      effects: {
        apAll: 0, apHead: 0, apBody: 0, apArms: 0, apLegs: 0,
        apVsEnergy: 0, apVsImpact: 0, apVsRending: 0, apVsBlast: 0,
        maxAgilityMod: 0, addProps: [], charBonuses: []
      },
      drukhari: false
    }
  },
  // ── Способности, черты, состояния (wdbc-ff4.1.3) ───────────────────────────
  talent: {
    pack: "talents",
    defaults: {
      description: "", notes: "", benefit: "", bookSource: "", tier: 1,
      requirement: "", aptitudes: [], aptSource: "", aspirations: [], god: "",
      specialization: "", cost: 0, purchased: false, granted: false,
      effects: { initMod: 0, fearRating: 0, speedMod: 0 }
    },
    migratedAway: ["effects.charBonusStat", "effects.charBonusValue"]
  },
  ability: {
    // Предметов этого типа в паках нет — способности заводит сам ГМ.
    pack: null,
    defaults: { description: "", notes: "", benefit: "" }
  },
  mutation: {
    pack: "mutations",
    defaults: {
      description: "", notes: "", benefit: "", source: "", bookSource: "",
      roll: "", god: "",
      // В template.json объявлено не было, но лежит у трёх мутаций пака и
      // читается общим пикером Талантов, Черт и Мутаций — как у Черты.
      requirement: "",
      effects: {
        charBonuses: [], charValueBonuses: [], armourAll: 0,
        fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0
      }
    },
    migratedAway: ["effects.charBonusStat", "effects.charBonusValue"]
  },
  disease: {
    pack: "diseases",
    defaults: {
      diseaseType: "warp", severity: "", god: "nurgle", contagion: "",
      incubation: "", symptoms: "", vectors: "", cure: "", active: false,
      description: "", notes: ""
    }
  },
  mentalDisorder: {
    // Предметов этого типа в паках нет — расстройства заводит сам ГМ.
    pack: null,
    defaults: { description: "", notes: "", testChar: "wp", testMod: 0 }
  },

  // ── Оружие и броня (wdbc-ff4.1.2) ──────────────────────────────────────────
  weapon: {
    pack: ["weapons", "vehicle-weapons"],
    defaults: {
      description: "", notes: "", rangeBands: [], offProfile: {}, gripProps2h: [],
      corEffects: [], weaponClass: "melee", weaponType: "laser", range: 0,
      balance: 0, grips: "", profileLabel: "", profiles: [], reload: "1",
      magazineCur: 0, magazineMax: 0, rof_single: 0, rof_semi: 0, rof_full: 0,
      damage: "", damageType: "impact", penetration: 0, quality: "common",
      availability: 0, weight: 0, attackBonus: 0, special: "", equipped: false,
      loadedAmmoId: "", weaponProps: [], needsRecharge: false, legacyWeapon: false,
      sacred: false,
      daemonWeapon: {
        bound: false, god: "", demonName: "", binding: 0, demonWb: 0, demonInf: 0,
        subdued: false, runic: false, properties: [], preProps: [], preDamage: "", prePen: 0
      },
      vehicleMount: {
        isMounted: false, operator: "gunner", stationId: "", mount: "turret",
        hArc: "360°", vArc: "", standard: false, reloads: 10
      },
      drukhari: false,
      // Ручной щит — рукопашное оружие, дающее AP на прикрываемые зоны
      // (combat/hand-shield.mjs). В template.json объявлены не были.
      // shieldAP именно null, а не 0: сама «щитовость» определяется наличием
      // поля (`s.shieldAP != null` в sheet-helpers.mjs и isHandShield),
      // и умолчание 0 сделало бы щитом всё оружие подряд.
      shieldAP: null, shieldZones: "", shieldForm: ""
    }
  },
  ammo: {
    pack: "ammunition",
    defaults: {
      description: "", notes: "", weaponTypes: [], ammoCategory: "bullets",
      rarity: 0, quantity: 0, weight: 0, availability: 0, attackMod: 0,
      damageMod: 0, damageDiceMod: 0, damageTypeOverride: "", penetrationMod: 0,
      rangeMod: 0, rangeMultiplier: 1, special: "", properties: [], condMods: [],
      drukhari: false
    }
  },
  armor: {
    pack: "armor",
    defaults: {
      description: "", notes: "", armorType: "simple", stacks: false,
      maxAgility: 100, propRatings: {}, apSecond: {}, equipped: false,
      head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0,
      quality: "common", availability: 0, weight: 0, properties: [],
      strengthBonus: 0, wpBonus: 0, drukhari: false, fieldMode: "",
      history: {
        table: "", key: "", roll: 0, name: "", desc: "", effect: "", choice: "",
        zones: {},
        second: { table: "", key: "", roll: 0, name: "", desc: "", effect: "", choice: "" }
      },
      // Текст особенностей комплекта — заполнен у 65 предметов пака, а в
      // template.json объявлен не был.
      special: ""
    }
  },
  forcefield: {
    pack: "shields",
    defaults: {
      description: "", notes: "", shieldNature: "technological", shieldType: "dome",
      ratingMin: 1, ratingMax: 35, overloadThreshold: 10, currentRating: 0,
      isSpecialRating: false, equipped: false, status: "inactive",
      quality: "common", availability: 2, weight: 0, drukhari: false
    }
  }
};

const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");

/** Документы пака (или нескольких): по файлу на предмет, папки — папки компендиума. */
function packDocuments(pack, type) {
  if (Array.isArray(pack)) return pack.flatMap(p => packDocuments(p, type));
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

      // Тип без предметов в паках (cybernetic) проверять нечем — сохранность
      // спрашивается у настоящих данных, а их нет.
      it.skipIf(!pack)("документы пака проходят через схему без потерь", () => {
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
