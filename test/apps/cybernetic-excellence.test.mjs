// test/apps/cybernetic-excellence.test.mjs
//
// syncCyberneticExcellenceArms(actor) — держит Трейт Multiple Arms в согласии
// с числом покупок Таланта Cybernetic Excellence (rules/cybernetic-excellence.mjs
// покрывает чистые функции отдельно). Пак Трейтов стабуется тем же приёмом,
// что test/constants/mutations-item-data.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { syncCyberneticExcellenceArms } from "../../module/apps/cybernetic-excellence.mjs";

const MULTIPLE_ARMS_TEMPLATE = {
  name: "Multiple Arms / Многорукий (X)", type: "trait",
  system: { hasRating: true, rating: 2, effects: {} }
};

function fakePack(index, documents) {
  return {
    getIndex: async () => index,
    getDocument: async id => documents[id] ? { toObject: () => structuredClone(documents[id]) } : null
  };
}

/** Предмет-заглушка: getFlag/setFlag/update/delete правят один и тот же объект. */
function itemStub(data) {
  const it = structuredClone(data);
  it.flags ??= {};
  it.getFlag = (scope, key) => it.flags[scope]?.[key];
  it.update = async changes => {
    for (const [path, value] of Object.entries(changes)) {
      const m = path.match(/^flags\.([^.]+)\.(.+)$/);
      if (m) { (it.flags[m[1]] ??= {})[m[2]] = value; continue; }
      const keys = path.split(".");
      let node = it;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  it.delete = async () => { actorItems.splice(actorItems.indexOf(it), 1); };
  return it;
}

let actorItems;

function actorWith(items = []) {
  actorItems = items.map(itemStub);
  const actor = new Actor();
  actor.items = actorItems;
  actor.createEmbeddedDocuments = async (type, [data]) => {
    const it = itemStub(data);
    actorItems.push(it);
    return [it];
  };
  return actor;
}

beforeEach(() => {
  globalThis.game.packs = new Map([
    ["warhammer-dbc.traits", fakePack(
      [{ _id: "ma1", name: MULTIPLE_ARMS_TEMPLATE.name }],
      { ma1: MULTIPLE_ARMS_TEMPLATE }
    )]
  ]);
});

describe("syncCyberneticExcellenceArms", () => {
  it("нет Таланта, нет Трейта — ничего не делает", async () => {
    const actor = actorWith([]);
    await syncCyberneticExcellenceArms(actor);
    expect(actor.items).toHaveLength(0);
  });

  it("первая покупка — заводит Трейт с рейтингом 2 (база) + 1", async () => {
    const actor = actorWith([{ type: "talent", name: "Cybernetic Excellence / Кибернетическое Превосходство", system: { hasRating: true, rating: 1 } }]);
    await syncCyberneticExcellenceArms(actor);
    const trait = actor.items.find(i => i.type === "trait");
    expect(trait).toBeTruthy();
    expect(trait.system.rating).toBe(3);
    expect(trait.getFlag("warhammer-dbc", "ceContribution")).toBe(1);
  });

  it("вторая покупка (rating=2 на Таланте) — поднимает существующий Трейт ещё на 1", async () => {
    const actor = actorWith([
      { type: "talent", name: "Cybernetic Excellence / Кибернетическое Превосходство", system: { hasRating: true, rating: 1 } },
      { type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating: 3 }, flags: { "warhammer-dbc": { ceContribution: 1 } } }
    ]);
    // Талант подняли до 2 покупок (как это делает createOrRankTalent при повторной покупке).
    const talent = actor.items.find(i => i.type === "talent");
    await talent.update({ "system.rating": 2 });
    await syncCyberneticExcellenceArms(actor);

    const trait = actor.items.find(i => i.type === "trait");
    expect(trait.system.rating).toBe(4);
    expect(trait.getFlag("warhammer-dbc", "ceContribution")).toBe(2);
  });

  it("не трогает чужой вклад в тот же Трейт (раса дала 4 руки помимо Таланта)", async () => {
    const actor = actorWith([
      { type: "talent", name: "Cybernetic Excellence / Кибернетическое Превосходство", system: { hasRating: true, rating: 1 } },
      { type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating: 5 }, flags: { "warhammer-dbc": { ceContribution: 1 } } }
      // 5 = 4 (раса) + 1 (этот Талант) — до синка уже верно.
    ]);
    await syncCyberneticExcellenceArms(actor);   // уже синхронизировано (1 === 1) — ничего не меняется

    const trait = actor.items.find(i => i.type === "trait");
    expect(trait.system.rating).toBe(5);
  });

  it("Талант убрали целиком — снимает свой вклад, Трейт остаётся с чужим", async () => {
    const actor = actorWith([
      { type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating: 5 }, flags: { "warhammer-dbc": { ceContribution: 1 } } }
      // Талант удалён СНАРУЖИ (deleteItem уже случился) — 4 остаётся от расы.
    ]);
    await syncCyberneticExcellenceArms(actor);

    const trait = actor.items.find(i => i.type === "trait");
    expect(trait.system.rating).toBe(4);
    expect(trait.getFlag("warhammer-dbc", "ceContribution")).toBe(0);
  });

  it("Талант убрали, а Трейт был только от него — Трейт удаляется целиком", async () => {
    const actor = actorWith([
      { type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating: 3 }, flags: { "warhammer-dbc": { ceContribution: 1 } } }
    ]);
    await syncCyberneticExcellenceArms(actor);
    expect(actor.items.find(i => i.type === "trait")).toBeUndefined();
  });

  it("уже синхронизировано — второй вызов ничего не пишет", async () => {
    const actor = actorWith([
      { type: "talent", name: "Cybernetic Excellence / Кибернетическое Превосходство", system: { hasRating: true, rating: 2 } },
      { type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating: 4 }, flags: { "warhammer-dbc": { ceContribution: 2 } } }
    ]);
    const trait = actor.items.find(i => i.type === "trait");
    let updated = false;
    trait.update = async () => { updated = true; };
    await syncCyberneticExcellenceArms(actor);
    expect(updated).toBe(false);
  });
});
