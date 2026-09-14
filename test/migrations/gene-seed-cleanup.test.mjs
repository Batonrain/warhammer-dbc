// test/migrations/gene-seed-cleanup.test.mjs
//
// Система Органов Геносемени снята целиком, но у сыгранных персонажей предметы
// остались на листах. Чистка обязана снести ровно её остатки и не задеть чужие
// импланты — иначе миграция вычистит Механикус вместе с Прогеноидами.

import { describe, it, expect, afterEach } from "vitest";
import { isGeneSeedLeftover, geneSeedLeftoverIds, migrateRemoveGeneSeed } from "../../module/migrations/gene-seed-cleanup.mjs";

/** Предмет актора: чистка читает флаги и через getFlag, и из сырых данных. */
function item({ id, name = "Предмет", type = "implant", category = "", flags = {} }) {
  return {
    id, name, type,
    system: category ? { category } : {},
    flags: { "warhammer-dbc": flags },
    getFlag: (_scope, key) => flags[key]
  };
}

describe("чистка остатков Органов Геносемени", () => {
  it("сносит органы по категории, по флагу и Кислотный плевок", () => {
    expect(isGeneSeedLeftover(item({ id: "1", category: "geneseed" }))).toBe(true);
    expect(isGeneSeedLeftover(item({ id: "2", flags: { geneSeed: true } }))).toBe(true);
    expect(isGeneSeedLeftover(item({
      id: "3", type: "weapon", name: "Кислотный плевок (Железа Бетчера)"
    }))).toBe(true);
  });

  it("чужие импланты и оружие не трогает", () => {
    expect(isGeneSeedLeftover(item({ id: "4", category: "mechanicus" }))).toBe(false);
    expect(isGeneSeedLeftover(item({ id: "5", category: "bioimplant" }))).toBe(false);
    expect(isGeneSeedLeftover(item({ id: "6", type: "weapon", name: "Болтер" }))).toBe(false);
  });

  it("из коллекции листа отбирает только id остатков", () => {
    const ids = geneSeedLeftoverIds([
      item({ id: "organ", category: "geneseed" }),
      item({ id: "mech", category: "mechanicus" }),
      item({ id: "spit", type: "weapon", name: "Кислотный плевок (Железа Бетчера)" }),
      item({ id: "bolter", type: "weapon", name: "Болтер" })
    ]);

    expect(ids).toEqual(["organ", "spit"]);
  });
});

// wdbc-059h: по образцу gear-equipped/wdbc-dyi — было один try на ВЕСЬ цикл по
// акторам, сбой на одном глушил чистку остальным молча.
describe("migrateRemoveGeneSeed: изоляция сбоя одного актора (wdbc-059h)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  function actorWith(id, items, { throwOnDelete = false } = {}) {
    return {
      id, name: `Actor ${id}`, items,
      async deleteEmbeddedDocuments(type, ids) {
        if (throwOnDelete) throw new Error(`boom on ${id}`);
        for (const delId of ids) {
          const idx = items.findIndex(i => i.id === delId);
          if (idx >= 0) items.splice(idx, 1);
        }
      }
    };
  }

  it("сбой на одном акторе не прерывает чистку остальным и не топит их результат", async () => {
    const bad = actorWith("bad", [item({ id: "organ1", category: "geneseed" })], { throwOnDelete: true });
    const good = actorWith("good", [item({ id: "organ2", category: "geneseed" })]);

    globalThis.game = { user: { isGM: true }, actors: [bad, good], scenes: [], items: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateRemoveGeneSeed();

    expect(res.actorCount).toBe(1);
    expect(res.failed).toBe(1);
    expect(good.items).toEqual([]);
    expect(bad.items.map(i => i.id)).toEqual(["organ1"]);
  });
});
