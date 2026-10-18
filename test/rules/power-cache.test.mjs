// test/rules/power-cache.test.mjs
//
// Power Cache / Силовой Заряд (technomystic.core.powerCache): «Персонаж
// увеличивает максимальный заряд Катушки Потенции на ½I.b (окр.▲). Не
// действует на Катушку Апокрифу.» Проверяется через полный конвейер
// подготовки актора (prepareDerivedData → character.mjs →
// final-pools.mjs::prepareFinalPools), тот же приём, что
// test/documents/implant-code-bonus.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const powerCacheItem = () => ({
  id: "pc", name: "Power Cache / Силовой Заряд", type: "talent", system: {},
  getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "technomystic.core.powerCache", label: "" }
  ] }] } }
});

/** Персонаж с заданным Int (base) и указанными предметами. */
function characterWith(intBase, items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.int.base = intBase;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Power Cache: +½I.b (окр.▲) к максимальному заряду Катушки Потенции", () => {
  it("с Талантом, Int 42 (I.b 4) — maxTotal получает +2", () => {
    const withTalent = characterWith(42, [powerCacheItem()]);
    const without = characterWith(42, []);
    expect(withTalent.energy.maxTotal).toBe(without.energy.maxTotal + 2);
  });

  it("без Таланта — energy.maxTotal не меняется", () => {
    const system = characterWith(45, []);
    expect(system.energy.bonusMax).toBe(0);
  });

  it("окр.▲: Int 50 (I.b 5, нечётный) → +3 (ceil(5/2)), не +2", () => {
    const system = characterWith(50, [powerCacheItem()]);
    expect(system.energy.bonusMax).toBe(3);
  });
});
