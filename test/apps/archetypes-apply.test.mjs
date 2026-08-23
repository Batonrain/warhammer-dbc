// test/apps/archetypes-apply.test.mjs
//
// applyArchetype раньше применял isPsyker/isTechpriest/psykerClass/
// grantsImplants/grantsWarPlate только через Мастера создания (одноразовое
// чтение сырых полей архетипа, apps/creation.mjs) — сам селектор «Архетип» в
// шапке листа (этот же applyArchetype, живой путь смены архетипа ПОСЛЕ
// чарГена) их никогда не выставлял. charBonus и сигнатурная Черта сюда не
// входят — они переехали в саму Механику носителя (kind:"characteristic"/
// "trait") и проверяются в другом месте (сама Механика применяется общим
// applyItemMechanics, здесь не переигрывается, т.к. actor — не instanceof
// Actor в тестовой заглушке и applyItemMechanics тихо возвращается).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyArchetype } from "../../module/apps/archetypes.mjs";

const PACK = "warhammer-dbc.archetypes";

function implantItem(id, name) {
  return { id, type: "implant", name, getFlag() { return undefined; } };
}

function actorStub(items = []) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    system: { archetype: "" },
    items: list, updates: [], created: [],
    update: async data => { actor.updates.push(data); return data; },
    createEmbeddedDocuments: async (_type, docs) => {
      const made = docs.map((d, i) => ({
        ...d, id: `made-${actor.created.length}-${i}`, type: d.type || "implant",
        getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
      }));
      actor.created.push(...made);
      list.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async () => []
  };
  return actor;
}

function archetypeDoc(system) {
  return {
    id: "arch-1",
    system: { key: "testArch", ...system },
    toObject() { return { _id: this.id, name: "Test Archetype", type: "archetype", system: this.system, flags: {} }; }
  };
}

beforeEach(() => {
  game.packs = new Map();
});

describe("applyArchetype: isPsyker/isTechpriest/psykerClass раньше выставлял только Мастер создания", () => {

  it("isPsyker true пишет system.isPsyker актору", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({ isPsyker: true })] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.updates.some(u => u["system.isPsyker"] === true)).toBe(true);
  });

  it("isTechpriest true пишет system.isTechpriest актору", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({ isTechpriest: true })] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.updates.some(u => u["system.isTechpriest"] === true)).toBe(true);
  });

  it("psykerClass пишет system.psyker.class актору", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({ isPsyker: true, psykerClass: "bound" })] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.updates.some(u => u["system.psyker.class"] === "bound")).toBe(true);
  });

  it("архетип без этих полей не пишет их вовсе", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({})] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.updates.some(u => "system.isPsyker" in u)).toBe(false);
    expect(actor.updates.some(u => "system.isTechpriest" in u)).toBe(false);
    expect(actor.updates.some(u => "system.psyker.class" in u)).toBe(false);
  });
});

describe("applyArchetype: grantsImplants/grantsWarPlate раньше выдавал только Мастер создания", () => {

  it("grantsImplants создаёт Импланты Механикум", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({ grantsImplants: true })] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.created.some(i => i.type === "implant")).toBe(true);
  });

  it("уже стоящий Имплант с тем же именем не задваивается (идемпотентно)", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({ grantsImplants: true })] });
    const existing = implantItem("impl-1", "Electro-Graft / Электро-Имплантат");
    const actor = actorStub([existing]);

    await applyArchetype(actor, "testArch");

    const implants = actor.created.filter(i => i.type === "implant");
    expect(implants.some(i => i.name === existing.name)).toBe(false);
    // остальные 6 имплантов Механикум всё равно выдаются
    expect(implants.length).toBe(6);
  });

  it("grantsWarPlate создаёт Латы Скитарии, только если ещё не стоят", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({ grantsWarPlate: true })] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.created.filter(i => i.type === "implant").length).toBe(1);
  });

  it("ни grantsImplants, ни grantsWarPlate — ничего не создаёт", async () => {
    game.packs.set(PACK, { getDocuments: async () => [archetypeDoc({})] });
    const actor = actorStub();

    await applyArchetype(actor, "testArch");

    expect(actor.created.filter(i => i.type === "implant").length).toBe(0);
  });
});
