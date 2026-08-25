// test/data/armor-bonus-key.test.mjs
//
// Складываемая надбавка AP (естественная броня Черт, броня имплантов) целится в
// system.armorBonus.<зона> — ХРАНИМОЕ поле схемы, и потому фаза у неё
// "initial": расчёт листа читает его в середине prepareDerivedData, а не после.
// Тот же приём, что у system.encumbrance.indexBonus (documents/actor.mjs).
//
// До wdbc-b3m ключ назывался system.armour.<зона> — поля с таким именем у
// актора нет вовсе (в схеме system.armor, американское написание, и это ручной
// блок, который берётся через Math.max, а не складывается). Эффект тихо писал в
// никуда, и AP всех перенесённых предметов был мёртв. Отсюда две проверки: что
// новый ключ в схеме есть и что старого в вайтлисте не осталось.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";

import { EFFECT_KEY_LABELS, EFFECT_KEY_WHITELIST, expectedPhase,
         legacyEffectsToChanges, summarizeEffectChanges } from "../../module/constants/effect-keys.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const LOCATIONS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];
/** Типы актора, чей лист считает броню по зонам (одна ветка prepareDerivedData). */
const ARMORED_ACTORS = ["character", "daemon", "demonPrince"];

/** Схема типа берётся из класса данных — все типы актора переведены. */
function armorBonusOf(type) {
  return new ACTOR_DATA_MODELS[type]({}).armorBonus;
}

describe("ключ складываемой брони", () => {
  it("armorBonus объявлен в схеме каждого носящего броню актора", () => {
    for (const type of ARMORED_ACTORS) {
      const bonus = armorBonusOf(type);
      expect(bonus, type).toBeDefined();
      expect(Object.keys(bonus).sort(), type).toEqual([...LOCATIONS].sort());
    }
  });

  it("мёртвого ключа system.armour.* в вайтлисте не осталось", () => {
    expect(EFFECT_KEY_WHITELIST.filter(k => k.startsWith("system.armour."))).toEqual([]);
  });

  it("у каждой зоны есть подпись", () => {
    for (const loc of LOCATIONS)
      expect(EFFECT_KEY_LABELS[`system.armorBonus.${loc}`], loc).toBeTruthy();
  });

  it("armourAll и apAll ложатся на все шесть зон в фазе initial", () => {
    for (const field of ["armourAll", "apAll"]) {
      const changes = legacyEffectsToChanges({ [field]: 2 });
      expect(changes.map(c => c.key).sort(), field)
        .toEqual(LOCATIONS.map(l => `system.armorBonus.${l}`).sort());
      expect(changes.every(c => c.phase === "initial" && c.type === "add" && c.value === 2), field)
        .toBe(true);
    }
  });

  it("пер-локационные поля попадают каждое в свою зону", () => {
    const changes = legacyEffectsToChanges({ apHead: 6, apBody: 7, apArms: 7, apLegs: 5 });
    expect(Object.fromEntries(changes.map(c => [c.key, c.value]))).toEqual({
      "system.armorBonus.head":     6,
      "system.armorBonus.body":     7,
      "system.armorBonus.leftArm":  7,
      "system.armorBonus.rightArm": 7,
      "system.armorBonus.leftLeg":  5,
      "system.armorBonus.rightLeg": 5
    });
  });
});

// Лист предмета помечал предупреждением любую строку не в фазе "final"
// (item-sheet.mjs). После wdbc-b3m это неправда: у хранимого поля фаза обязана
// быть "initial", и такими же всегда были сдвиг индекса грузоподъёмности и SPD
// Конструктора — все они получали ложное «⚠ initial».
// Деления у ядра Foundry нет: divideUp/divideDown применяет хук
// "applyActiveEffect" (warhammer-dbc.mjs), и Конструктор их предлагает.
// Своим типам нужна и своя подпись, иначе сводка на листе предмета печатает
// сырое «divideUp2» — механика работает, а выглядит поломкой.
describe("подписи типов изменения", () => {
  it("свои типы деления подписаны, а не печатаются как есть", () => {
    const summary = summarizeEffectChanges([
      { key: "system.characteristics.ag.totalFx", type: "divideUp", value: 2 },
      { key: "system.characteristics.s.totalFx",  type: "divideDown", value: 2 }
    ]);
    expect(summary).toBe("Ag (значение) ÷↑ (вверх)2, S (значение) ÷↓ (вниз)2");
  });
});

// Надбавка к Бонусу характеристики целилась в system.characteristics.<k>.bonus
// в фазе "final". Но Бонус СЧИТАЕТСЯ расчётом листа, и эффект ложился поверх
// готового числа: лист показывал новый T.b, а броня, навыки и перемещения
// считались по старому (wdbc-5wm). Цель — хранимое .bonusFx, фаза "initial".
describe("надбавка к Бонусу характеристики", () => {
  it("старый ключ .bonus в вайтлисте не остался", () => {
    expect(EFFECT_KEY_WHITELIST.filter(k => /^system\.characteristics\.\w+\.bonus$/.test(k)))
      .toEqual([]);
  });

  it("у нового ключа есть подпись, и она та же", () => {
    expect(EFFECT_KEY_LABELS["system.characteristics.t.bonusFx"]).toBe("T (бонус, Unnatural)");
  });

  it("перенос легаси целится в него в фазе initial", () => {
    const changes = legacyEffectsToChanges({ charBonusStat: "t", charBonusValue: 2 });
    expect(changes).toEqual([{ key: "system.characteristics.t.bonusFx", type: "add",
                               value: 2, phase: "initial", priority: 0 }]);
  });

  it("бонус к ЗНАЧЕНИЮ целится в .totalFx — по той же причине", () => {
    // Считалось, что .total пересчитывается заново каждый проход и потому
    // эффект поверх него «работает». Он и правда не затирается — но ложится
    // ПОСЛЕ расчёта, а Бонус, навыки и броня выведены из старого значения
    // раньше. Проверено на живом prepareDerivedData: запись 10 в .total не
    // меняет ни Бонус, ни поглощение (test/documents/char-bonus-reaches-armor).
    const changes = legacyEffectsToChanges({ charValueBonuses: [{ stat: "s", value: 3 }] });
    expect(changes[0]).toMatchObject({ key: "system.characteristics.s.totalFx", phase: "initial" });
  });

  it("старый ключ .total в вайтлисте тоже не остался", () => {
    expect(EFFECT_KEY_WHITELIST.filter(k => /^system\.characteristics\.\w+\.total$/.test(k)))
      .toEqual([]);
  });
});

describe("какая фаза какому ключу положена", () => {
  it("хранимым полям — initial", () => {
    for (const key of ["system.armorBonus.head",
                       "system.encumbrance.indexBonus.all",
                       "system.movement.spdBonus",
                       "system.characteristics.t.bonusFx"])
      expect(expectedPhase(key), key).toBe("initial");
  });

  it("производным — final", () => {
    for (const key of ["system.characteristics.s.total",
                       "system.characteristics.s.bonus",   // мёртвый ключ: чинится миграцией
                       "system.absorption.vsType.energy",
                       "system.encumbrance.carry",
                       "system.fearRating"])
      expect(expectedPhase(key), key).toBe("final");
  });
});
