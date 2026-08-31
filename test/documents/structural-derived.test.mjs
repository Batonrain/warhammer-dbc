// test/documents/structural-derived.test.mjs
//
// Расчёт листов Отряда, Формирования и Техники после выноса в module/rules/
// (squad.mjs, formation.mjs, vehicle.mjs). Ожидания сняты с расчёта ДО выноса
// (actor.mjs на main) на тех же данных — совпадение доказывает, что переезд
// ничего не поменял; тот же приём, что у horde-derived/ship-hull-derived.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function deepPatch(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object") deepPatch(target[k], v);
    else target[k] = v;
  }
}

/** Актор структурного типа со схемой по умолчанию — расчёт без живого документа. */
function derivedOf(type, patch = {}, itemList = []) {
  const system = new ACTOR_DATA_MODELS[type]({}).toObject();
  deepPatch(system, patch);
  const items = Object.assign([...itemList], { get: () => null });
  const actorLike = Object.assign(Object.create(WarhammerActor.prototype),
    { type, name: "Подставной", system, items, getFlag: () => undefined, flags: {} });
  actorLike.prepareDerivedData();
  return system;
}

describe("Отряд: Слаженность и Риск", () => {
  it("полоса, модификаторы Команд, надлом и число бойцов", () => {
    const s = derivedOf("squad", {
      cohesion: { base: 10, start: 5, value: -15 }, risk: 3,
      members: [{ uuid: "Actor.0" }, { uuid: "Actor.1" }]
    });
    expect(s.derived).toMatchObject({
      cohesion: -15, cohesionCmd: -15, cohesionCoord: -30, cohesionBand: "strained",
      cohesionPct: 31, belowStart: true, broken: true, risk: 3, riskCap: 7, memberCount: 2
    });
  });

  it("значения за пределами шкалы обрезаются, риск зажат в 1…5", () => {
    const s = derivedOf("squad", { cohesion: { base: 99, start: -99, value: 45 }, risk: 9 });
    expect(s.cohesion.value).toBe(40);
    expect(s.risk).toBe(5);
    expect(s.derived.cohesionPct).toBe(100);
  });
});

describe("Формирование: сила, скорость, истощение", () => {
  it("средняя пехота элитной выучки батальоном, приказ «В атаку»", () => {
    const s = derivedOf("formation", {
      troopType: "mediumInfantry", training: "elite", size: "battalion", order: { key: "charge" },
      terrain: "open", status: { exhausted: false, disorder: 0 }, cover: { dugIn: true, aa: 4, mod: 1 },
      numbers: { value: 72, max: 100 }, morale: { value: 30, max: 50 }, techLevel: 2, attached: []
    });
    expect(s.initiative).toBe(6);
    expect(s.derived).toMatchObject({
      strength: 4, defence: 8, dice: 4, damageFormula: "4d10 + 4", speed: 20, cover: 6,
      skillValue: 60, testValue: 55, numbersLost: 28, numbersPct: 72, moraleLost: 20, moralePct: 60,
      penalty: -5, halfMorale: 25, quarterMorale: 12, atHalf: false, routed: false,
      availability: -30, sizeLabel: "Батальон (Эскадрилья)"
    });
  });
});

describe("Техника: ходовая и Черты техники", () => {
  const trait = (effects, rating = 0, rating2 = 0, rating3 = 0) =>
    ({ type: "vehicleTrait", system: { effects, rating, rating2, rating3 } });

  it("шагоход с повреждённой ходовой, дефлектором и автопилотом", () => {
    const s = derivedOf("vehicle", {
      chassis: { type: "walker", spd: 12, spdDamage: 2, manoeuvreDamage: 0, strength: 50, unnaturalS: 20 },
      manoeuvrability: 10, size: 2, structure: { value: 4, max: 10 }
    }, [
      trait({ openTopped: true, manoeuvreMod: 5, spdMod: -1, spdDamageReduce: 1, deflectorShield: true }, 3),
      trait({ autonomous: true, fullMoveSpdMult: 3, swerveDisabled: true, critHalved: true, commandBonus: 10, repairBonus: 5 }, 40, 35, 30)
    ]);
    expect(s.openTopped).toBe(true);
    expect(s.derived).toMatchObject({
      chassisType: "walker", effSpd: 10, spdDamaged: true,
      movement: { smallMove: 10, fullMove: 30, run: 40 },
      manoeuvreMod: 15, swerveMod: -20, swerveDisabled: true, walker: true,
      strengthBonus: 7, liftKg: 14, halfWrecked: false, deflector: 3,
      autonomous: true, autonomousOperate: 40, autonomousBS: 35, autonomousAwareness: 30
    });
    expect(s.derived.traitFlags).toMatchObject({ commandBonus: 10, repairBonus: 5, critHalved: true });
  });
});
