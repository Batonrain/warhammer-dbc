// test/apps/mechanics-when-ability-sync.test.mjs
//
// Черта, выданная Конструктором с условием «Когда Ярость», должна сниматься,
// когда условие пропало, и возвращаться, когда оно снова выполнено — как
// эффекты у syncMechanicsEffects. Раньше syncGrantedAbilities только
// создавала недостающее и снимала всё лишь при неактивном предмете.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { syncGrantedAbilities, hasWhenGatedAbilityGrant } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

function setup({ inRage }) {
  const actor = new Actor();
  actor.system = { inRage };
  const items = [];
  actor.items = items;
  items.contents = items;
  let seq = 0;
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => ({ id: `g-${seq++}`, name: d.name, type: d.type, flags: d.flags,
      getFlag: (_s, k) => d.flags?.[FLAG]?.[k] }));
    items.push(...made);
    return made;
  };
  actor.deleteEmbeddedDocuments = async (_t, ids) => {
    for (const id of ids) items.splice(items.findIndex(i => i.id === id), 1);
    return ids;
  };
  const mechanics = [{ id: "g1", operator: "AND", entries: [{
    id: "e-machine", kind: "trait", sourceUuid: "Compendium.warhammer-dbc.traits.Item.abc123", sourceName: "Machine / Машина", rating: "",
    when: { negate: false, conditions: [], requireRage: true }
  }] }];
  const source = { id: "src", type: "mutation", name: "Бронзовый Мирмидон", system: {}, parent: actor,
    flags: { [FLAG]: { mechanics } }, getFlag: (_s, k) => ({ mechanics })[k] };
  items.push(source);
  return { actor, source, granted: () => items.filter(i => i.getFlag?.(FLAG, "grantedByItem") === "src") };
}

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

describe("выдача Черты «Когда Ярость» следует за состоянием актора", () => {
  it("предмет с такой записью опознаётся", () => {
    expect(hasWhenGatedAbilityGrant(setup({ inRage: false }).source)).toBe(true);
  });

  it("в Ярости — Черта выдаётся; вышел из Ярости — снимается; снова в Ярости — возвращается", async () => {
    const { actor, source, granted } = setup({ inRage: true });
    await syncGrantedAbilities(source);
    expect(granted().map(i => i.name)).toEqual(["Machine / Машина"]);

    actor.system.inRage = false;
    await syncGrantedAbilities(source);
    expect(granted()).toEqual([]);

    actor.system.inRage = true;
    await syncGrantedAbilities(source);
    expect(granted()).toHaveLength(1);
  });
});
