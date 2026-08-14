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
import fs   from "node:fs";
import path from "node:path";

import { EFFECT_KEY_LABELS, EFFECT_KEY_WHITELIST, expectedPhase,
         legacyEffectsToChanges, summarizeEffectChanges } from "../../module/constants/effect-keys.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const template = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../../template.json"), "utf8"));

const LOCATIONS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];
/** Типы актора, чей лист считает броню по зонам (одна ветка prepareDerivedData). */
const ARMORED_ACTORS = ["character", "daemon", "demonPrince"];

/** Схема типа: у переведённых — класс данных, у остальных ещё template.json. */
function armorBonusOf(type) {
  const Model = ACTOR_DATA_MODELS[type];
  return Model ? new Model({}).armorBonus : template.Actor[type]?.armorBonus;
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
      { key: "system.characteristics.ag.total", type: "divideUp", value: 2 },
      { key: "system.characteristics.s.total",  type: "divideDown", value: 2 }
    ]);
    expect(summary).toBe("Ag (значение) ÷↑ (вверх)2, S (значение) ÷↓ (вниз)2");
  });
});

describe("какая фаза какому ключу положена", () => {
  it("хранимым полям — initial", () => {
    for (const key of ["system.armorBonus.head",
                       "system.encumbrance.indexBonus.all",
                       "system.movement.spdBonus"])
      expect(expectedPhase(key), key).toBe("initial");
  });

  it("производным — final", () => {
    for (const key of ["system.characteristics.s.total",
                       "system.absorption.vsType.energy",
                       "system.encumbrance.carry",
                       "system.fearRating"])
      expect(expectedPhase(key), key).toBe("final");
  });
});
