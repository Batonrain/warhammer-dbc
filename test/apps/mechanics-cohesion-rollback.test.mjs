// test/apps/mechanics-cohesion-rollback.test.mjs
//
// Слаженность отряда от записи kind:"cohesion" откатывается по флагу
// cohesionApplied, даже когда самой записи на предмете уже нет — так бывает,
// когда Историю комплекта силовой брони снимают или перебрасывают
// (apps/armour-history.mjs вырезает её группу из flags.mechanics целиком).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

function itemOnActor({ mechanics = [], flags = {} } = {}) {
  const own = { mechanics, ...flags };
  const actor = new Actor();
  actor.uuid = "Actor.a1";
  actor.system = {};
  actor.update = async () => actor;
  actor.createEmbeddedDocuments = async (_t, docs) => docs;
  const item = {
    id: "item-1", uuid: "Actor.a1.Item.item-1", type: "armor", name: "Броня", img: "",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => docs,
    deleteEmbeddedDocuments: async (_t, ids) => ids
  };
  actor.items = [item];
  return item;
}

let prevFromUuid, prevActors;
beforeEach(() => {
  globalThis.game.user = { isGM: true };
  prevFromUuid = globalThis.fromUuid;
  prevActors = globalThis.game.actors;
  globalThis.game.actors = []; // актор ни в каком отряде не состоит
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; globalThis.game.actors = prevActors; });

describe("откат Слаженности без записи на предмете", () => {
  it("применённое снимается с отряда по флагу, флаг стирается", async () => {
    const squad = {
      uuid: "Actor.sq1", system: { cohesion: { base: 15 } },
      update: async d => { squad.system.cohesion.base = d["system.cohesion.base"]; }
    };
    globalThis.fromUuid = async uuid => (uuid === squad.uuid ? squad : null);
    const item = itemOnActor({ flags: { cohesionApplied: { squadUuid: squad.uuid, amount: 10 } } });

    await applyItemMechanics(item);

    expect(squad.system.cohesion.base).toBe(5);
    expect(item.getFlag(FLAG, "cohesionApplied")).toBeUndefined();
  });

  it("без флага откатывать нечего — отряд не трогается", async () => {
    let touched = false;
    globalThis.fromUuid = async () => { touched = true; return null; };
    const item = itemOnActor();
    await applyItemMechanics(item);
    expect(touched).toBe(false);
  });
});
