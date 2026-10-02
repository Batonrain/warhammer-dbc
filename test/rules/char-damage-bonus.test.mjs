// test/rules/char-damage-bonus.test.mjs
//
// wdbc-3epax: надбавки Генетического Угасания (Репликант) и Нестабильного
// Генома (Сплайс) растут от каждого урона в Характеристики — в том числе от
// источников мимо applyCharDamage (Руна Сигиллита).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { charDamageWithBonuses } from "../../module/rules/char-damage-bonus.mjs";
import { improvisedRuneCostUpdates } from "../../module/rules/sigillite-runes.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const decayDoc = allPackDocuments("traits").map(({ doc }) => doc).find(d => d._id === "s88qmAjylqfRunf9");
const decay = { ...structuredClone(decayDoc), id: decayDoc._id, type: "trait",
  getFlag: (s, k) => decayDoc.flags?.[s]?.[k] };
const mutation = god => ({ type: "mutation", name: "m", system: { god }, flags: {} });
const genome = { type: "trait", name: "Unstable Genome / Нестабильный Геном", flags: {} };
const adapt = { type: "trait", name: "a", flags: { "warhammer-dbc": { spliceAdaptation: "sensory" } } };

describe("charDamageWithBonuses", () => {
  it("без Черт урон не меняется", () => {
    expect(charDamageWithBonuses({ items: [] }, 3)).toEqual({ amount: 3, decay: 0, genome: 0 });
  });
  it("Угасание: +1 за каждую мутацию, Дар Богов не считается", () => {
    const a = { items: [decay, mutation(""), mutation(""), mutation("khorne")] };
    expect(charDamageWithBonuses(a, 1)).toEqual({ amount: 3, decay: 2, genome: 0 });
  });
  it("Геном: +1 (три обязательные адаптации — без доплаты)", () => {
    const a = { items: [genome, adapt, adapt, adapt] };
    expect(charDamageWithBonuses(a, 1)).toEqual({ amount: 2, decay: 0, genome: 1 });
  });
  it("ноль остаётся нулём", () => {
    const a = { items: [decay, mutation(""), genome] };
    expect(charDamageWithBonuses(a, 0).amount).toBe(0);
  });
});

describe("Импровизированная Руна — надбавки к урону в S/A/W", () => {
  const wounds = { value: 10, max: 10, critical: 0 };
  it("Репликант с двумя мутациями: по 3 урона вместо 1", () => {
    const a = { items: [decay, mutation(""), mutation("")], system: { wounds, charLoss: { s: 0, ag: 0, wp: 0 }, charLossAt: {},
      characteristics: { s: { total: 30 }, ag: { total: 30 }, wp: { total: 30 } } } };
    const portions = improvisedRuneCostUpdates(a)["system.charLossPortions"];
    expect(portions.map(p => p.amount)).toEqual([3, 3, 3]);
  });
});
