// test/documents/speed-talents-movement.test.mjs
//
// Запредельная Скорость и Спринт (глава 3) на листе: дистанции Движения.
//   Запредельная Скорость — Натиск на дистанцию Бега (SPD×6).
//   Спринт — Полное Движение SPD×3, Бег на двойную дистанцию (movement.sprintRun, SPD×12);
//            сам movement.run не удваивается.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ talents = [], ...patch } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 30; // Ag.b 3 → SPD 3
  Object.assign(system, patch);
  const list = talents.map((name, i) => ({ id: `t${i}`, type: "talent", name, system: {}, getFlag: () => undefined }));
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system.movement;
}

describe("дистанции Движения без Талантов (SPD 3)", () => {
  it("1 / 2 / 3 / 6 × SPD, sprintRun = 0", () => {
    const m = characterWith();
    expect([m.halfMove, m.move, m.charge, m.run, m.sprintRun]).toEqual([3, 6, 9, 18, 0]);
  });
});

describe("Запредельная Скорость", () => {
  it("Натиск = Бег (SPD×6), прочее не меняется", () => {
    const m = characterWith({ talents: ["Preternatural Speed / Запредельная Скорость"] });
    expect([m.halfMove, m.move, m.charge, m.run, m.sprintRun]).toEqual([3, 6, 18, 18, 0]);
  });
  it("Повален: обе дальности делятся пополам и остаются равны", () => {
    const m = characterWith({ talents: ["Preternatural Speed / Запредельная Скорость"], conditions: { prone: true } });
    expect(m.charge).toBe(m.run);
    expect(m.run).toBe(9);
  });
});

describe("Спринт", () => {
  it("Полное Движение = SPD×3, Бег SPD×6 остаётся, дальний Бег SPD×12", () => {
    const m = characterWith({ talents: ["Sprint / Спринт"] });
    expect([m.halfMove, m.move, m.charge, m.run, m.sprintRun]).toEqual([3, 9, 9, 18, 36]);
  });
  it("с Запредельной Скоростью: Натиск SPD×6, Полное всё равно SPD×3", () => {
    const m = characterWith({ talents: ["Sprint / Спринт", "Preternatural Speed / Запредельная Скорость"] });
    expect([m.move, m.charge, m.run, m.sprintRun]).toEqual([9, 18, 18, 36]);
  });
  it("Повален: дальности режутся пополам, sprintRun следует за Бегом", () => {
    const m = characterWith({ talents: ["Sprint / Спринт"], conditions: { prone: true } });
    expect([m.move, m.run, m.sprintRun]).toEqual([4.5, 9, 18]);
  });
});
