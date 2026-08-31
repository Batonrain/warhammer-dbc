// test/documents/psyker-always-bound.test.mjs
//
// wdbc-gzuf (Серый Человек): «независимо от обстоятельств всегда считается
// Связанным в расчёте трейта Psyker» — capabilityKey:"psyker.alwaysBound"
// принудительно ставит system.psyker.class = "bound" каждый цикл
// prepareDerivedData, откатывая любую ручную смену на листе.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function alwaysBoundTraitItem() {
  return {
    id: "trait-bound", name: "Oteshii Physiology / Физиология Отеший", type: "trait", system: {},
    getFlag: () => undefined,
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "psyker.alwaysBound", label: "" }
    ] }] } },
    effects: []
  };
}

function characterWith({ items = [], psykerClass = "unbound" } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.psyker.class = psykerClass;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("psyker.alwaysBound — принудительно «Связанный»", () => {
  it("без трейта — ручной выбор Природы Дара сохраняется как есть", () => {
    const system = characterWith({ psykerClass: "unbound" });
    expect(system.psyker.class).toBe("unbound");
  });

  it("с трейтом — «Несвязанный» откатывается обратно в «Связанный»", () => {
    const system = characterWith({ items: [alwaysBoundTraitItem()], psykerClass: "unbound" });
    expect(system.psyker.class).toBe("bound");
  });

  it("с трейтом — «Демонический» тоже откатывается", () => {
    const system = characterWith({ items: [alwaysBoundTraitItem()], psykerClass: "daemonic" });
    expect(system.psyker.class).toBe("bound");
  });
});
