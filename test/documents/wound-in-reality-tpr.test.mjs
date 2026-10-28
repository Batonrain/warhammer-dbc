// test/documents/wound-in-reality-tpr.test.mjs
//
// Рана в Реальности (пачка I2, Sahara 3-28): бесплатные силы не снижают тPR. Проверка — через
// настоящий пересчёт актора (prepareDerivedData), а не через вспомогательную функцию: поломка
// проводки в rules/character.mjs должна быть видна здесь. Талант — из настоящего пака.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { WOUND_FREE_FLAG } from "../../module/rules/wound-in-reality.mjs";

const woundDoc = () => packDocById("packs-src/talents/Псайкана", "HlOOH4XLJ1Oilfjn");

const item = (type, name, system = {}, flags = {}) => ({
  id: name, type, name, system, flags: { "warhammer-dbc": flags },
  getFlag(s, k) { return this.flags[s]?.[k]; }
});
const power = (name, { cost = 1, free = false } = {}) =>
  item("psychicPower", name, { isSustained: true, sustainCost: cost }, free ? { [WOUND_FREE_FLAG]: true } : {});

function psyker(items, { cor = 50, rating = 9 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.psyker.rating = rating;
  system.corruption.value = cor;   // Cor.b = 5
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system.psyker;
}

describe("Рана в Реальности: тPR", () => {
  const wound = () => { const d = woundDoc(); return item("talent", d.name, { ...d.system }); };

  it("без Таланта пометка ничего не меняет: платят все", () => {
    const p = psyker([power("A", { cost: 3 }), power("F", { free: true })]);
    expect(p.sustain).toBe(4);
    expect(p.currentRating).toBe(5);
  });
  it("с Талантом: бесплатная сила не отнимает тPR", () => {
    const p = psyker([wound(), power("A", { cost: 3 }), power("F", { free: true })]);
    expect(p.sustain).toBe(3);
    expect(p.currentRating).toBe(6);
  });
  it("платных меньше 3 PR — пометка не действует", () => {
    const p = psyker([wound(), power("A", { cost: 2 }), power("F", { free: true })]);
    expect(p.sustain).toBe(3);
  });
  it("сверх Cor.b силы платные", () => {
    const p = psyker([wound(), power("A", { cost: 3 }), power("F1", { free: true }), power("F2", { free: true })], { cor: 10 });
    // Cor.b = 1: одна бесплатная, вторая платит
    expect(p.sustain).toBe(4);
  });
});
