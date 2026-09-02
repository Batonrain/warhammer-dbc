// test/apps/mech-blocks-apply.test.mjs
//
// applyMechBlocks — Foundry-обвязка: применяет Effects блоков, что сработали
// на событие, переиспользуя тот же applyMechEntry(), что и старый формат
// groups (см. test/apps/mechanics-late-entries.test.mjs — тот же приём
// минимального предмета/актора).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured } from "../support/foundry-stub.mjs";
import { applyMechBlocks, applyMechBlocksForActor } from "../../module/apps/mech-blocks-apply.mjs";

const FLAG = "warhammer-dbc";

/** Предмет на акторе: столько, сколько трогает applyMechEntry для kind:"wounds"/"trait". */
function itemOnActor({ mechBlocks = [], actorItems = [] } = {}) {
  const own = { mechBlocks };
  const actor = new Actor();
  actor.system = { wounds: { max: 10 } };
  actor.items = actorItems;
  actor.update = async data => { actor.system.wounds.max = data["system.wounds.max"]; };
  actor.createEmbeddedDocuments = async (_t, docs) => docs;

  const item = {
    id: "item-1", type: "trait", name: "Блочная Черта", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [], flags: { [FLAG]: own },
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => docs,
    deleteEmbeddedDocuments: async () => []
  };
  return item;
}

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  captured.dice = []; // формула без "d" считается напрямую, не берёт дефолтный captured.nextRoll
});

describe("applyMechBlocks", () => {
  it("блок без Requirement и с Condition onGrant применяет свой Effect на событие onGrant", async () => {
    const item = itemOnActor({
      mechBlocks: [{
        requirement: null,
        condition: { kind: "onGrant" },
        effects: [{ id: "e1", kind: "wounds", op: "add", woundsValue: "3" }]
      }]
    });

    const fired = await applyMechBlocks(item, item.parent, { kind: "onGrant" });

    expect(fired).toBe(1);
    expect(item.parent.system.wounds.max).toBe(13);
  });

  it("не тот момент события — блок не срабатывает, эффект не применяется", async () => {
    const item = itemOnActor({
      mechBlocks: [{
        requirement: null,
        condition: { kind: "onRemove" },
        effects: [{ id: "e1", kind: "wounds", op: "add", woundsValue: "3" }]
      }]
    });

    const fired = await applyMechBlocks(item, item.parent, { kind: "onGrant" });

    expect(fired).toBe(0);
    expect(item.parent.system.wounds.max).toBe(10);
  });

  it("Requirement не выполнен (Кхорнит) — эффект блока не применяется, даже на верный Condition", async () => {
    const item = itemOnActor({
      mechBlocks: [{
        requirement: {
          tier: "primary", forbid: true,
          group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "Khornate" }] }
        },
        condition: { kind: "onGrant" },
        effects: [{ id: "e1", kind: "wounds", op: "add", woundsValue: "5" }]
      }]
    });

    const fired = await applyMechBlocks(item, item.parent, { kind: "onGrant" });

    expect(fired).toBe(0);
    expect(item.parent.system.wounds.max).toBe(10);
  });

  it("Requirement выполнен — эффект проходит", async () => {
    const item = itemOnActor({
      actorItems: [{ type: "trait", name: "Khornate", system: {} }],
      mechBlocks: [{
        requirement: {
          tier: "primary", forbid: true,
          group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "Khornate" }] }
        },
        condition: { kind: "onGrant" },
        effects: [{ id: "e1", kind: "wounds", op: "add", woundsValue: "5" }]
      }]
    });

    const fired = await applyMechBlocks(item, item.parent, { kind: "onGrant" });

    expect(fired).toBe(1);
    expect(item.parent.system.wounds.max).toBe(15);
  });

  it("несколько блоков — срабатывают независимо, эффекты складываются", async () => {
    const item = itemOnActor({
      mechBlocks: [
        { requirement: null, condition: { kind: "onGrant" }, effects: [{ id: "e1", kind: "wounds", op: "add", woundsValue: "2" }] },
        { requirement: null, condition: { kind: "onGrant" }, effects: [{ id: "e2", kind: "wounds", op: "add", woundsValue: "4" }] },
        { requirement: null, condition: { kind: "onRemove" }, effects: [{ id: "e3", kind: "wounds", op: "add", woundsValue: "100" }] }
      ]
    });

    const fired = await applyMechBlocks(item, item.parent, { kind: "onGrant" });

    expect(fired).toBe(2);
    expect(item.parent.system.wounds.max).toBe(16); // 10 + 2 + 4, третий блок не тронут
  });
});

describe("applyMechBlocksForActor", () => {
  /** Предмет-на-акторе того же вида, что itemOnActor, но переиспользующий ОДНОГО актора. */
  function itemFor(actor, id, mechBlocks) {
    const own = { mechBlocks };
    return {
      id, type: "trait", name: `Черта ${id}`, img: "icons/svg/aura.svg",
      system: {}, parent: actor, effects: [], flags: { [FLAG]: own },
      getFlag: (_s, k) => own[k],
      setFlag: async (_s, k, v) => { own[k] = v; return v; },
      unsetFlag: async (_s, k) => { delete own[k]; },
      update: async () => {},
      createEmbeddedDocuments: async (_t, docs) => docs,
      deleteEmbeddedDocuments: async () => []
    };
  }

  it("проходит по всем предметам актора, суммирует сработавшие блоки", async () => {
    const actor = new Actor();
    actor.system = { wounds: { max: 10 } };
    actor.update = async data => { actor.system.wounds.max = data["system.wounds.max"]; };
    actor.createEmbeddedDocuments = async (_t, docs) => docs;

    const a = itemFor(actor, "a", [{ requirement: null, condition: { kind: "onWoundsLoss" }, effects: [{ id: "e1", kind: "wounds", op: "add", woundsValue: "1" }] }]);
    const b = itemFor(actor, "b", [{ requirement: null, condition: { kind: "onGrant" }, effects: [{ id: "e2", kind: "wounds", op: "add", woundsValue: "100" }] }]);
    actor.items = [a, b];

    const fired = await applyMechBlocksForActor(actor, { kind: "onWoundsLoss" });

    expect(fired).toBe(1); // только a, у b Condition не тот
    expect(actor.system.wounds.max).toBe(11);
  });

  it("нет предметов — 0, не падает", async () => {
    const actor = new Actor();
    actor.items = [];
    expect(await applyMechBlocksForActor(actor, { kind: "onWoundsLoss" })).toBe(0);
  });
});
