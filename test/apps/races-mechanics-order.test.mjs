// test/apps/races-mechanics-order.test.mjs
//
// Находка I3 общего ревью (wdbc-n1k): Черты расы создаёт незавёрнутый хук
// createItem (warhammer-dbc.mjs → applyItemMechanics), а Foundry его промис
// не ждёт (Hooks.callAll не await'ит колбэки). applyRace/applySubrace кладут
// носителя и идут дальше — Мастер создания применяет расу и субразу подряд,
// и фильтр removesTraits у субрасы может пробежать по актору раньше, чем хук
// успел выдать расовые Черты.
//
// Чинится структурно: applyRace/applySubrace сами await'ят applyItemMechanics
// созданного носителя, не полагаясь на фоновый хук. Проверяем это здесь,
// подменяя applyItemMechanics своей реализацией: если applyRace её не зовёт
// напрямую, Черта на актора не попадёт СИНХРОННО с возвратом applyRace.

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi } from "vitest";

const mechanicsCalls = [];
vi.mock("../../module/apps/mechanics.mjs", () => ({
  applyItemMechanics: vi.fn(async item => {
    mechanicsCalls.push(item.id);
    // Имитирует то, что в жизни делает Конструктор при createItem: выдаёт
    // расовую Черту прямо на актора-носителя.
    item.parent.items.push({
      id: `granted-${item.id}`, type: "trait",
      name: "Natural Weapons / Естественное Оружие",
      getFlag: () => undefined
    });
  })
}));

vi.mock("../../module/apps/race-library.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    raceDef: key => key === "raceWithCarrier"
      ? { key, label: "Тестовая раса", chars: {}, uuid: "Compendium.test.races.race1" }
      : actual.raceDef(key)
  };
});

globalThis.fromUuid = async uuid => uuid === "Compendium.test.races.race1"
  ? { toObject: () => ({ _id: "race1", type: "race", name: "Тестовая раса", system: { key: "raceWithCarrier" } }) }
  : null;

const { applyRace } = await import("../../module/apps/races.mjs");

function actorStub() {
  const list = [];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    system: { characteristics: {}, skills: {}, groupSkills: {}, wounds: {} },
    items: list, updates: [],
    update: async data => { actor.updates.push(data); return data; },
    createEmbeddedDocuments: async (_t, docs) => {
      const made = docs.map((d, i) => ({ id: `carrier-${i}`, ...d, parent: actor, getFlag: () => undefined }));
      list.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async () => []
  };
  return actor;
}

describe("applyRace ждёт применение Механики носителя, а не полагается на хук", () => {
  it("расовая Черта уже на акторе сразу после applyRace — без ожидания хука", async () => {
    const actor = actorStub();

    await applyRace(actor, "raceWithCarrier");

    expect(mechanicsCalls.length).toBe(1);
    expect(actor.items.some(i => i.type === "trait")).toBe(true);
  });
});
