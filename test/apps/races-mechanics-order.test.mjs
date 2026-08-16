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
      : actual.raceDef(key),
    subraceEntries: () => ({
      subWithCarrier: { key: "subWithCarrier", label: "Тестовая субраса",
        parent: "raceWithCarrier", uuid: "Compendium.test.races.sub1" }
    })
  };
});

globalThis.fromUuid = async uuid => {
  if (uuid === "Compendium.test.races.race1")
    return { toObject: () => ({ _id: "race1", type: "race", name: "Тестовая раса", system: { key: "raceWithCarrier" } }) };
  if (uuid === "Compendium.test.races.sub1")
    return { toObject: () => ({ _id: "sub1", type: "subrace", name: "Тестовая субраса", system: { key: "subWithCarrier" } }) };
  return null;
};

const { applyRace, applySubrace, SKIP_MECHANICS_HOOK } = await import("../../module/apps/races.mjs");

function actorStub(over = {}) {
  const list = [];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    system: { characteristics: {}, skills: {}, groupSkills: {}, wounds: {}, ...over },
    items: list, updates: [], createOptions: [],
    update: async data => { actor.updates.push(data); return data; },
    createEmbeddedDocuments: async (_t, docs, options) => {
      actor.createOptions.push(options);
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

// Находка ревью (второй раунд, wdbc-n1k): applyItemMechanics вызывается и
// напрямую здесь, и из хука createItem (тот же предмет несёт originGrant и
// проходит мимо страховочной ветки на общее применение) — идемпотентность
// applyItemMechanics эту гонку не лечит (appliedEntryIds читает флаг ДО, а
// не после применения). Правильный контракт: создание носителя передаёт
// опцию, которая говорит хуку не применять Механику ещё раз.
describe("создание носителя передаёт SKIP_MECHANICS_HOOK — хук не должен применить Механику второй раз", () => {
  it("applyRace: опция стоит в контексте createEmbeddedDocuments носителя расы", async () => {
    const actor = actorStub();

    await applyRace(actor, "raceWithCarrier");

    expect(actor.createOptions[0]?.[SKIP_MECHANICS_HOOK]).toBe(true);
  });

  it("applySubrace: опция стоит в контексте createEmbeddedDocuments носителя субрасы", async () => {
    const actor = actorStub({ race: "raceWithCarrier" });

    await applySubrace(actor, "subWithCarrier");

    expect(actor.createOptions[0]?.[SKIP_MECHANICS_HOOK]).toBe(true);
  });
});
