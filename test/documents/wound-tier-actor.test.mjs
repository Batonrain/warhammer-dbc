// test/documents/wound-tier-actor.test.mjs
//
// Формула и классификация проверены отдельно в rules/wound-tier.test.mjs —
// здесь проверяется ДОВОД ДО АКТОРА: что prepareDerivedData реально кладёт
// tier/tierLabel/tierLost в system.wounds (tab-combat.hbs читает их напрямую),
// а не просто умеет их посчитать где-то в стороне (тот же приём проверки,
// что и test/documents/dreadnought-sanity.test.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ tBase = 0, value = 10, max = 10, critical = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.t.base = tBase;
  system.wounds.value = value;
  system.wounds.max = max;
  system.wounds.critical = critical;
  const list = [];
  list.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("system.wounds.tier доходит до актора", () => {
  it("полное здоровье — healthy / «Здоров»", () => {
    const s = characterWith({ tBase: 30, value: 10, max: 10 });
    expect(s.wounds.tier).toBe("healthy");
    expect(s.wounds.tierLabel).toBe("Здоров");
    expect(s.wounds.tierLost).toBe(0);
  });

  it("лёгкая рана (в пределах T.b×2) — light", () => {
    // T.b(30) = 3, T.b×2 = 6, потеряно 5 — ещё в пределах.
    const s = characterWith({ tBase: 30, value: 5, max: 10 });
    expect(s.wounds.tier).toBe("light");
    expect(s.wounds.tierLabel).toBe("Легко ранен");
  });

  it("тяжёлая рана (сверх T.b×2) — heavy", () => {
    const s = characterWith({ tBase: 30, value: 3, max: 10 });
    expect(s.wounds.tier).toBe("heavy");
    expect(s.wounds.tierLabel).toBe("Тяжело ранен");
  });

  it("критический урон (Раны в минусе) — dying", () => {
    const s = characterWith({ tBase: 30, value: 0, max: 10, critical: 2 });
    expect(s.wounds.tier).toBe("dying");
    expect(s.wounds.tierLabel).toBe("При смерти");
  });
});
