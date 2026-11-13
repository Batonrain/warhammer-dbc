// test/rules/quadruped.test.mjs
//
// dbc-114 / 55-15 (13.11.2026): Четвероногий (X) — «удваивает свой SPD и вес
// Ношения»; рейтинг 1 — на четвереньках (×2) или прямоходящим (как без Трейта).
// Решение владельца: удваивается ВЕСЬ SPD вместе с надбавками.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { quadrupedMultiplier, quadrupedTrait, isQuadrupedUpright, QUADRUPED_UPRIGHT_FLAG } from "../../module/rules/quadruped.mjs";

const trait = (rating, name = "Quadruped (X) / Четвероногий") => ({ type: "trait", name, system: { rating } });
const actor = (items = [], upright = false) => ({
  items, getFlag: (_s, k) => (k === QUADRUPED_UPRIGHT_FLAG ? upright : undefined)
});

describe("множитель SPD и Ношения", () => {
  it("без Черты — 1", () => expect(quadrupedMultiplier(actor())).toBe(1));
  it("рейтинги 0 и 2 — всегда ×2, даже с флагом «прямоходящий»", () => {
    expect(quadrupedMultiplier(actor([trait(0)]))).toBe(2);
    expect(quadrupedMultiplier(actor([trait(2)]))).toBe(2);
    expect(quadrupedMultiplier(actor([trait(0)], true))).toBe(2);
    expect(quadrupedMultiplier(actor([trait(2)], true))).toBe(2);
  });
  it("рейтинг 1: на четвереньках ×2, прямоходящий — 1", () => {
    expect(quadrupedMultiplier(actor([trait(1)], false))).toBe(2);
    expect(quadrupedMultiplier(actor([trait(1)], true))).toBe(1);
  });
  it("Черту опознаёт по любой половине имени; Талант или другой предмет того же имени — нет", () => {
    expect(quadrupedTrait(actor([trait(1, "Четвероногий")]))).not.toBeNull();
    expect(quadrupedTrait(actor([{ type: "talent", name: "Quadruped", system: {} }]))).toBeNull();
    expect(quadrupedTrait(null)).toBeNull();
  });
  it("флаг режима читается и из actor.flags", () => {
    expect(isQuadrupedUpright({ flags: { "warhammer-dbc": { [QUADRUPED_UPRIGHT_FLAG]: true } } })).toBe(true);
    expect(isQuadrupedUpright({})).toBe(false);
  });
});

describe("пак-данные Четвероногого", () => {
  const dir = path.resolve("packs-src/traits");
  const j = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(x => x.startsWith("Quadruped___"))), "utf8"));
  it("кнопка режима вызывает toggleQuadrupedMode", () => {
    const e = j.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(x => x.kind === "script");
    expect(e?.code).toContain("toggleQuadrupedMode(actor)");
  });
  it("описание — по книге: рейтинг 1 — четвереньки или прямоходящий", () => {
    expect(j.system.description).toContain("прямоходящим");
    expect(j.system.description).toContain("кентавр");
  });
});

// Сквозной прогон настоящего prepareDerivedData (тот же приём, что character-gravity.test.mjs):
// один и тот же персонаж с Трейтом и без — SPD и Ношение вдвое.
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function derived(items, upright = false) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  // Предмет «на акторе»: расчёт листа спрашивает у него флаги (getFlag) и uuid.
  const list = items.map(i => ({ id: "i-q", flags: {}, getFlag: () => undefined, ...i }));
  list.get = () => null;
  const actor = {
    type: "character", name: "Подставной", system, items: list,
    getFlag: (_s, k) => (k === QUADRUPED_UPRIGHT_FLAG ? upright : undefined)
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("настоящий расчёт листа: SPD и Ношение ×2", () => {
  const base = derived([]);
  it("Трейт (0) удваивает SPD, Полушаг и Ношение; Подъём и Толкание не меняются", () => {
    const q = derived([trait(0)]);
    expect(base.movement.halfMove).toBeGreaterThan(0);
    expect(q.movement.halfMove).toBe(base.movement.halfMove * 2);
    expect(q.movement.run).toBe(base.movement.run * 2);
    expect(q.encumbrance.carry).toBe(base.encumbrance.carry * 2);
    expect(q.encumbrance.lift).toBe(base.encumbrance.lift);
    expect(q.encumbrance.push).toBe(base.encumbrance.push);
  });
  it("рейтинг 1: на четвереньках ×2, прямоходящий — как без Трейта", () => {
    expect(derived([trait(1)], false).movement.halfMove).toBe(base.movement.halfMove * 2);
    expect(derived([trait(1)], true).movement.halfMove).toBe(base.movement.halfMove);
    expect(derived([trait(1)], true).encumbrance.carry).toBe(base.encumbrance.carry);
  });
});
