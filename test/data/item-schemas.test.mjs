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
import { packDocuments, leaves, isEmpty } from "../support/pack-docs.mjs";

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
    // `notes` добавлено следом за `description`: общий блок ЗАПИСИ на листе
    // предмета рисуется для любого типа, а в схеме поля не было — правка
    // молча терялась.
    defaults: {
      description: "", notes: "", reminder: "", category: "both",
      hasRating: false, hasRating2: false, autoKey: "", bookSource: ""
    }
  },
  aspiration: {
    pack: "aspirations",
    // `notes` — по той же причине, что и у weaponProperty выше.
    defaults: { key: "", table: "pride", n: 0, mods: "", description: "", notes: "", bookSource: "" }
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
      quality: "common", gearCategory: "misc", linkedWeapon: "", worn: "", wornOn: "",
      effect: "", reminder: "", qualityEffects: { poor: "", good: "", best: "" },
      isRig: false, rig: { comfort: "normal", backSlot: false, slots: [], magLocks: [] },
      itemSize: "", bonuses: [], drukhari: false, bookSource: "",
      // В template.json объявлено не было, но лежит у 20 предметов пака —
      // след раскладки по папкам компендиума при импорте. Кодом не читается;
      // объявлено, чтобы правка предмета в игре его не стирала.
      folderPath: [],
      // Инфограждение (module/apps/infoguard.mjs) — Успехи встречного теста.
      infoguard: 0
    }
  },
  tool: {
    pack: "tools",
    defaults: {
      description: "", notes: "", quantity: 1, weight: 0, availability: 0,
      quality: "common", toolCategory: "general", linkedWeapon: "", effect: "",
      reminder: "", qualityEffects: { poor: "", good: "", best: "" },
      bonuses: [], drukhari: false, bookSource: "", infoguard: 0
    }
  },
  cybernetic: {
    // Предметов этого типа в паках нет — сохранять нечего, проверяются
    // только умолчания.
    pack: null,
    defaults: {
      description: "", notes: "", installed: "", linkedWeapon: "",
      quality: "common", availability: 0, weight: 0, bookSource: ""
    }
  },
  implant: {
    pack: "implants",
    defaults: {
      description: "", notes: "", category: "mechanicus", quality: "common",
      effect: "", installed: "", linkedWeapon: "", bookSource: "",
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
      activatable: false, active: false, runicWeaveSlots: 0,
      effects: {
        apAll: 0, apHead: 0, apBody: 0, apArms: 0, apLegs: 0,
        apVsEnergy: 0, apVsImpact: 0, apVsRending: 0, apVsBlast: 0,
        maxAgilityMod: 0, addProps: [], charBonuses: []
      },
      drukhari: false
    }
  },
  // ── Данные персонажа (wdbc-ff4.1.5) ────────────────────────────────────────
  // У всех четырёх «справочных» типов в данных лежит `notes`, которого в
  // template.json не было: лист предмета показывает это поле всем типам.
  homeworld: {
    pack: "homeworlds",
    defaults: {
      key: "", description: "", notes: "", source: "", bookSource: "",
      featureName: "", featureDesc: "", charModLabel: "", choices: {},
      friendlySpecs: [], effects: { charValueBonuses: [] }
    }
  },
  divination: {
    pack: "divinations",
    defaults: {
      key: "", roll: "", rollMin: 0, rollMax: 0, text: "", effect: "",
      source: "", bookSource: "", charModLabel: "", choices: {},
      description: "", notes: "", effects: { charValueBonuses: [] }
    }
  },
  archetype: {
    pack: "archetypes",
    defaults: {
      key: "", race: "", group: "", charBonus: {}, charChoice: "", skills: "",
      talents: "", gear: "", wounds: "", infRoll: "", requiredPath: "",
      isPsyker: false, isTechpriest: false, psykerClass: "",
      grantsWarPlate: false, grantsImplants: false, description: "", notes: "",
      trait: { name: "", benefit: "" }, bookSource: ""
    }
  },
  // Элитные архетипы (корбук стр. 114-164): ступень поверх Архетипа. Трейты и
  // Дополнительные Таланты — списками имён: сами записи лежат в библиотеках
  // Черт и Талантов, и копировать их сюда значило бы править одно в двух местах.
  eliteArchetype: {
    pack: "elite-archetypes",
    defaults: {
      // cost — цена по книге, paidCost — сколько заплатил этот персонаж
      // (с удвоением за каждый предыдущий Элитный архетип).
      key: "", cost: 0, paidCost: 0,
      requirements: { primary: [], secondary: [] },
      race: "", god: "", req: "", charBonus: "", freeTalents: "",
      gear: "", traits: [], talents: [], description: "", notes: "", bookSource: ""
    }
  },
  race: {
    pack: "races",
    // `largeBase` (wdbc-8k0i) — крупная База токена (3×3), в template.json не было.
    defaults: {
      key: "", group: "", chars: {}, bonusRolls: 0, skills: "", gear: "", talents: "",
      description: "", notes: "", hasGeneSeed: false, pastRaces: [], largeBase: false,
      size: 0, bonusPoints: 0, charShift: 0, fateRoll: "", skillsNote: "", adaptations: "",
      bookSource: ""
    }
  },
  subrace: {
    pack: "races",
    defaults: {
      key: "", parentKey: "", cost: 0, effect: "", god: "", charMods: {}, talents: "",
      removesTraits: [], description: "", notes: "", bookSource: ""
    }
  },
  armourHistoryEntry: {
    pack: "armour-histories",
    defaults: {
      table: "", rollMin: 0, rollMax: 0, description: "", notes: "", effect: "",
      hasChoice: false, choiceLabel: "", choicePlaceholder: "", zoneRoll: false,
      bookSource: ""
    }
  },
  drug: {
    pack: "chemistry",
    defaults: {
      description: "", notes: "", drugCategory: "medicine",
      deliveryMethod: "injection", quantity: 1, weight: 0, availability: 0,
      quality: "common", duration: "", effect: "", afterEffect: "",
      afterEffectDice: "", afterEffectCharDamage: { stat: "", formula: "" },
      hasAfterEffect: false,
      addiction: {
        hasAddiction: false, isAddicted: false, minDose: 0, testChar: "t",
        testMod: 0, frequency: "", penalty: ""
      },
      statMods:            { ws: 0, bs: 0, s: 0, t: 0, ag: 0, int: 0, per: 0, wp: 0, fel: 0 },
      afterEffectStatMods: { ws: 0, bs: 0, s: 0, t: 0, ag: 0, int: 0, per: 0, wp: 0, fel: 0 },
      specialEffects: {
        removesBleedingLevels: 0, removesHaemorrhagingLevels: 0,
        removesFatigueLevels: 0, removesWounds: 0, healFormula: "",
        healsWoundsPerRound: "", woundDamage: "", grantsFatigue: 0,
        woundsToToughness: false, removesCondition: "", removesConditionLevel: 0,
        grantsCondition: "", grantsConditionLevel: 1, immuneToPoisons: false,
        counteractsDrugs: false, removesRadiation: false, bonusVsPoisons: 0,
        reduceDamageOnHit: 0, noSleepNeeded: false, noFatigueFromMarch: false,
        customEffect: ""
      },
      afterEffectSpecial: {
        removesBleedingLevels: 0, removesHaemorrhagingLevels: 0,
        removesFatigueLevels: 0, removesWounds: 0, healFormula: "",
        woundDamage: "", grantsFatigue: 0, grantsCondition: "",
        grantsConditionLevel: 1, customEffect: ""
      },
      poisonVector: [], poisonEffect: "", poisonTestChar: "t", poisonTestMod: 0,
      // appliedAt/expiresAt — метки времени мира: null значит «не применялось».
      activeEffect: {
        isActive: false, isAfterEffect: false, appliedAt: null, expiresAt: null,
        roundsRemaining: 0, charDamageStat: "", charDamageAmount: 0
      }
    }
  },

  // ── Способности, черты, состояния (wdbc-ff4.1.3) ───────────────────────────
  talent: {
    pack: "talents",
    defaults: {
      description: "", notes: "", benefit: "", bookSource: "", tier: 1,
      requirement: "", aptitudes: [], aptSource: "", aspirations: [], god: "",
      specialization: "", cost: 0, purchased: false, granted: false,
      // Уровень (Enemy 1-3) и цели (Hatred/Peer/Enemy/Good Reputation) —
      // добавлены вместе с деревом фракций, в template.json их не было.
      hasRating: false, rating: 0, targets: [],
      // Ручная цена (вкладка «Развитие», wdbc-cct) — тоже позже template.json.
      costManual: false,
      effects: { initMod: 0, fearRating: 0, speedMod: 0 }
    },
    migratedAway: ["effects.charBonusStat", "effects.charBonusValue"]
  },
  ability: {
    // Предметов этого типа в паках нет — способности заводит сам ГМ.
    pack: null,
    defaults: { description: "", notes: "", benefit: "", bookSource: "" }
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
      },
      // Выпавшая субмутация (стр. 440): в template.json поля не было, в паке
      // его тоже нет — оно заполняется броском уже на листе персонажа.
      submutation: { name: "", label: "", text: "", god: "", roll: 0, shift: 0, total: 0 }
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
    defaults: { description: "", notes: "", testChar: "wp", testMod: 0, bookSource: "" }
  },

  // ── Оружие и броня (wdbc-ff4.1.2) ──────────────────────────────────────────
  weapon: {
    pack: ["weapons", "vehicle-weapons"],
    defaults: {
      description: "", notes: "", infoguard: 0, rangeBands: [], offProfile: {}, gripProps2h: [],
      corEffects: [], weaponClass: "melee", weaponType: "laser", itemSize: "", range: 0,
      balance: 0, grips: "", profileLabel: "", meleeCategory: "", profiles: [], reload: "1",
      magazineCur: 0, magazineMax: 0, rof_single: 0, rof_semi: 0, rof_full: 0,
      damage: "", damageType: "impact", penetration: 0, quality: "common",
      availability: 0, weight: 0, quantity: 1, attackBonus: 0, special: "", equipped: false,
      loadedAmmoId: "", weaponProps: [], needsRecharge: false, prismaCharge: 0, legacyWeapon: false,
      sacred: false,
      daemonWeapon: {
        bound: false, god: "", demonName: "", binding: 0, demonWb: 0, demonInf: 0,
        subdued: false, runic: false, properties: [], preProps: [], preDamage: "", prePen: 0
      },
      // Оружие Наследия (стр. 426-428) заведено позже template.json: признак
      // «реликвия» (legacyWeapon) был и раньше, а механика — История, Характер,
      // Мутации и снимок профиля до Возвышения — появилась вместе с правилами.
      legacy: {
        active: false, legendary: false, historyKey: 0, historyName: "", historyText: "",
        character: "", mutations: [], bonus: 0,
        preProps: [], preDamage: "", prePen: 0, preQuality: ""
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
      // Свойства, которые боеприпас у оружия отнимает (Инферно Тзинча — Tearing):
      // поля не было, и замена держалась на одном тексте «Особенностей».
      removeProps: [],
      drukhari: false
    }
  },
  armor: {
    pack: "armor",
    defaults: {
      description: "", notes: "", infoguard: 0, armorType: "simple", stacks: false,
      maxAgility: 100, propRatings: {}, apSecond: {}, equipped: false,
      // `largeBase` (wdbc-8k0i) — пока надета, токен носителя 3×3, в template.json не было.
      largeBase: false,
      head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0,
      quality: "common", availability: 0, weight: 0, properties: [],
      strengthBonus: 0, wpBonus: 0, drukhari: false, fieldMode: "",
      isRig: false, rig: { comfort: "normal", backSlot: false, slots: [], magLocks: [] },
      history: {
        table: "", key: "", roll: 0, name: "", desc: "", effect: "", choice: "",
        zones: {},
        second: { table: "", key: "", roll: 0, name: "", desc: "", effect: "", choice: "" }
      },
      // Текст особенностей комплекта — заполнен у 65 предметов пака, а в
      // template.json объявлен не был.
      special: "",
      weightless: false,
      active: true
    }
  },
  // ── Силы (wdbc-ff4.1.4) ────────────────────────────────────────────────────
  psychicPower: {
    pack: "psychic-powers",
    defaults: {
      description: "", notes: "", cost: 0, discipline: "", subtype: "",
      powerType: "attack", extraTypes: [], shootSubtype: "", prRequired: 1,
      testChar: "wp", testMod: 0, action: "half", range: "",
      sustainable: false, sustainCost: 1, sustainAction: "free",
      damage: "", damageType: "energy", penetration: 0, weaponProps: [],
      charDamageStat: "", charDamageFormula: "", profiles: [], variants: [],
      effect: "", isSustained: false,
      effects: {
        charBonusStat: "", charBonusValue: 0, charBonuses: [],
        armourAll: 0, fearRating: 0, sizeMod: 0, grantedTraits: "",
        weaponBuff: {
          enabled: false, scope: "equipped",
          damageMod: 0, penMod: 0, rangeMod: 0, addProps: []
        }
      }
    }
  },
  techPower: {
    pack: "tech-powers",
    defaults: {
      description: "", notes: "", discipline: "", subtype: "",
      miracleType: "imperative", extraTypes: [], iron: "", cost: 0, rating: 1,
      cognitionCost: 1, energyCost: 0, sustainCost: 0, sustainAction: "free",
      testSkill: "techUse", testMod: 0, action: "full", sustained: false,
      compiled: false, range: "", damage: "", damageType: "energy",
      penetration: 0, weaponProps: [], effect: "",
      effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [] }
    }
  },
  navigatorPower: {
    // Предметов этого типа в паках нет — силы Навигатора заводит сам ГМ.
    pack: null,
    defaults: {
      description: "", notes: "", xpCost: 0, requirement: "", action: "half",
      sustainable: false, isSustained: false, testChar: "wp", testMod: 0,
      opposed: false, range: "", powerKind: "Концентрация, Ментальное",
      damage: "", damageType: "energy", penetration: 0, effect: ""
    }
  },

  // ── Корабль и техника (wdbc-ff4.1.6) ───────────────────────────────────────
  component: {
    pack: "ship-components",
    defaults: {
      kind: "supplemental", power: 0, space: 0, sp: 0, rarity: 0,
      quality: "common", qualityPicks: [], qualityCustom: false,
      hulls: "", aspects: "", description: "", notes: "",
      essential: false, external: false, damaged: false, status: "intact",
      lcBonus: 0, pcBonus: 0, modChar: "", modValue: 0, shipProps: [],
      hull:  { spaceMax: 0, powerGen: 0, turnArc: "90°", weaponCapacity: "", hullIntegrity: 0 },
      chars: { speed: 0, manoeuvrability: 0, detection: 0, voidShields: 0, armour: 0, turretRating: 0 },
      weapon: { wType: "macrobattery", strength: 0, damage: "", crit: 0, range: 0, arc: "" }
    }
  },
  shipHull: {
    // Корпус — отдельный тип (не узел): выбирается пикером в шапке листа
    // корабля (sheets/hull-picker.mjs), а не через список Узлов.
    pack: "ship-components",
    defaults: {
      hullClass: "", sp: 0, rarity: 0, quality: "common", qualityPicks: [], qualityCustom: false,
      aspects: "", description: "", notes: "", shipProps: [],
      hull:  { spaceMax: 0, powerGen: 0, turnArc: "90°", weaponCapacity: "", hullIntegrity: 0 },
      chars: { speed: 0, manoeuvrability: 0, detection: 0, voidShields: 0, armour: 0, turretRating: 0 }
    }
  },
  cargo: {
    pack: "ship-components",
    defaults: {
      cargoType: "minerals", lc: 1, quantity: 1, quality: "common", rarity: 0,
      baseRarity: "", shipSupply: false, rarityManual: false, xenos: false,
      astartes: false, inHold: false, price: 0, origin: "", consignee: "",
      description: "",
      // В template.json объявлено не было, но лежит у четырёх грузов пака.
      notes: ""
    }
  },
  torpedo: {
    // Предметов этого типа в паках нет — торпеды заводит сам ГМ.
    pack: null,
    // `notes` — по той же причине, что и у weaponProperty выше.
    defaults: { warhead: "plasma", navSystem: "standard", quantity: 0, description: "", notes: "" }
  },
  celestialBody: {
    // Небесные тела лежат предметами в акторах starSystem, отдельного пака нет.
    pack: null,
    defaults: {
      description: "", notes: "", bodyType: "planet", zone: "", parentId: "",
      starClass: "", starGroup: 0, exotic: false, bodySize: "", gravity: "",
      atmospherePresence: "", atmosphereType: "", climate: "", habitability: "",
      worldClass: "", worldEnv: "", tithe: "", titheExempt: [],
      orbitalFeatures: "", territories: "", government: "", threat: "",
      stationType: "", presence: "", allegiance: "", xenosSpecies: "",
      xenosCustom: "", gmNotes: "", signal: false, scouted: false,
      revealed: false, dynasty: "", extractiums: [],
      defense:    { weapons: "", garrison: "", patrols: "", strength: "", notes: "" },
      population: { species: "", size: "", notes: "" },
      improvements: [],
      resources: {
        ore: 0, promethium: 0, adamantium: 0, phlogiston: 0, organics: 0,
        plasteel: 0, weapons: 0, tech: 0, provisions: 0, manpower: 0,
        archeotech: 0, xenotech: 0, heretek: 0, notes: ""
      }
    }
  },
  vehicleGear: {
    pack: "vehicle-equipment",
    defaults: { description: "", notes: "", availability: 0, quality: "common", active: true,
                bookSource: "" }
  },
  vehicleTrait: {
    pack: "vehicle-traits",
    defaults: {
      description: "", notes: "", benefit: "", availability: 0,
      hasRating: false, rating: 0, hasRating2: false, rating2: 0,
      hasRating3: false, rating3: 0,
      // Пять последних флагов в template.json объявлены не были: они появились
      // в библиотеке Черт позже и лежат у всех предметов пака. Умолчание берётся
      // из самой библиотеки (VEHICLE_TRAIT_EFFECTS).
      effects: {
        openTopped: false, manoeuvreMod: 0, spdMod: 0, spdDamageReduce: 0,
        noMove: false, swerveDisabled: false, fullMoveSpdMult: 0,
        smallMoveOnly: false, ignoreDifficultTerrain: false, critHalved: false,
        trackHitsToHull: false, siege: false, reloadRapid: false,
        commandBonus: 0, repairBonus: 0,
        deflectorShield: false, deflectorDaemonic: false, ignoreCrewCrits: false,
        autonomous: false, flickerfield: false
      }
    }
  },
  smallCraft: {
    pack: "small-craft",
    defaults: {
      description: "", notes: "", craftKind: "fighter", faction: "", cr: 0,
      crAlt: 0, spd: 0, squadronSize: 0, props: "", rarity: 0, qty: 1,
      state: "stored", strength: "full", turnsOut: 0, role: "independent"
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
  },

  // ── Ритуалы (wdbc-5ed, контент — wdbc-qg1) ─────────────────────────────────
  ritual: {
    pack: "rituals",
    defaults: {
      description: "", notes: "", source: "", bookSource: "",
      ritualType: "summon", record: 0, assistMin: 0, assistMax: 0,
      procedure: "", result: "", cost: "", failureCost: "",
      testSkillScope: "", testSkillKey: "", testSpecialty: "",
      testChar: "int", testMod: 0
    }
  },

  mentalTrauma: {
    // Заводится провалом теста Травмы, в паках таких предметов нет.
    pack: null,
    defaults: { description: "", notes: "", testChar: "wp", testMod: 0 }
  },

  // ── Рунические Вязи (корбук стр. 433-434) ──────────────────────────────────
  runicWeave: {
    pack: "runic-weaves",
    defaults: {
      description: "", notes: "", availability: 0, craftDiff: 0, craftBank: 0,
      surface: "", surfaceKinds: [], installedOnType: "", installedOn: "",
      wornPosition: "", active: false, bookSource: ""
    }
  },

  // ── Дерево принадлежностей ────────────────────────────────────────────────
  // Тип заведён сразу схемой, в template.json его никогда не было, поэтому
  // «умолчания прежнего template.json» здесь читаются как «умолчания, с
  // которыми тип родился»: тест держит их от случайной смены ровно так же.
  faction: {
    pack: "factions",
    defaults: {
      // Поле называется parentKey, а не parent: имя `parent` у любого
      // DataModel занято ссылкой на документ-владелец и схему им закрывало —
      // см. шапку module/data/item/faction.mjs.
      key: "", parentKey: "", alsoIn: [], aliases: [], isLore: false,
      description: "", notes: "", bookSource: ""
    }
  }
};

describe("типы данных предметов", () => {
  // Полей в system.json больше нет вовсе, остался только перечень типов:
  // тип, попавший в этот перечень без схемы, не получит ни одного поля.
  it("у каждого типа из system.json есть схема, и каждая проверена", () => {
    const declared = Object.keys(JSON.parse(fs.readFileSync(
      path.resolve(import.meta.dirname, "../../system.json"), "utf8")).documentTypes.Item);
    expect(Object.keys(ITEM_DATA_MODELS).sort()).toEqual([...declared].sort());
    expect(Object.keys(TYPES).sort()).toEqual([...declared].sort());
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

  // ── Разовые переезды ──────────────────────────────────────────────────────
  describe("Фракция: parent → parentKey", () => {
    const Faction = ITEM_DATA_MODELS.faction;

    it("строковый ключ переезжает в новое поле", () => {
      expect(new Faction({ parent: "chaos" }).parentKey).toBe("chaos");
    });

    // Прежнее имя поля закрывалось свойством DataModel, и первое же сохранение
    // клало в него документ целиком. Последнее верное значение осталось внутри
    // этого документа — оттуда его и достаём, иначе собранное вручную дерево
    // развалилось бы при обновлении.
    it("документ вместо ключа не теряет прежнее значение", () => {
      const broken = { name: "Несущие Слово", system: { parent: "traitor-legions" } };
      expect(new Faction({ parent: broken }).parentKey).toBe("traitor-legions");
    });

    it("мусор без прежнего значения гасится, а не остаётся объектом", () => {
      expect(new Faction({ parent: { name: "Пусто" } }).parentKey).toBe("");
      expect(new Faction({ parent: {} }).toObject().parent).toBeUndefined();
    });

    it("уже переехавшее поле переезд не трогает", () => {
      expect(new Faction({ parent: "chaos", parentKey: "imperium" }).parentKey).toBe("imperium");
    });
  });
});
