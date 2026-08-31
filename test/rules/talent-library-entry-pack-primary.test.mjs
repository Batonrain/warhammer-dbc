// test/rules/talent-library-entry-pack-primary.test.mjs
//
// talentLibraryEntry(name) (module/rules/duplicate-grants.mjs) — wdbc-h59i.
// Раньше читала только статическую TALENT_LIBRARY (без Механики, отстаёт от
// пака на ~518/1273 записей новых книг). Теперь СНАЧАЛА ищет документ в
// собранном компендиуме warhammer-dbc.talents (тот же приём, что
// mutationItemData в constants/mutations.mjs — см. test/constants/
// mutations-item-data.test.mjs, отсюда и структура этого файла), и только
// если пака нет/недоступен/совпадения не нашлось — откатывается на константу.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { talentLibraryEntry } from "../../module/rules/duplicate-grants.mjs";

function fakePack(index, documents) {
  return {
    getIndex: async () => index,
    getDocument: async (id) => documents[id] ? { toObject: () => documents[id] } : null
  };
}

beforeEach(() => {
  globalThis.game.packs = undefined;
});

describe("talentLibraryEntry — без собранного пака", () => {
  it("нет game.packs вовсе — запасной путь из TALENT_LIBRARY", async () => {
    const entry = await talentLibraryEntry("Combat Sense / Чувство Боя");
    expect(entry?.type).toBe("talent");
    expect(entry?.system?.tier).toBe(1);
  });

  it("неизвестное имя — null", async () => {
    expect(await talentLibraryEntry("Такого таланта нет")).toBeNull();
  });
});

describe("talentLibraryEntry — пак собран", () => {
  it("совпадение по имени — приезжает документ пака (с Механикой, если есть)", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents", fakePack(
      [{ _id: "id1", name: "Совсем Новый Талант" }],
      { id1: { name: "Совсем Новый Талант", type: "talent", system: { tier: 2 },
               flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [] }] } } } }
    )]]);
    const entry = await talentLibraryEntry("Совсем Новый Талант");
    expect(entry.system.tier).toBe(2);
    expect(entry.flags["warhammer-dbc"].mechanics).toHaveLength(1);
  });

  it("нет совпадения в паке — откат на TALENT_LIBRARY", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents", fakePack([], {})]]);
    const entry = await talentLibraryEntry("Combat Sense / Чувство Боя");
    expect(entry?.type).toBe("talent");
  });

  it("пак упал (getIndex бросает) — тихий откат на запасной путь, не падает", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents",
      { getIndex: async () => { throw new Error("недоступен"); } }]]);
    const entry = await talentLibraryEntry("Combat Sense / Чувство Боя");
    expect(entry?.type).toBe("talent");
  });
});
