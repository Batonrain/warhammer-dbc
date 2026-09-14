// test/migrations/content-sync-baseline.test.mjs
//
// Бутстрап опоры «Обновить мир»: у предметов без flags.contentSync.baseline,
// но с соответствием в паке, опору нужно поставить; у остальных — не трогать.

import { describe, it, expect, afterEach } from "vitest";
import { itemsNeedingBaseline, stampContentSyncBaseline } from "../../module/migrations/content-sync-baseline.mjs";
import { buildPackIndex } from "../../module/apps/content-sync.mjs";

const doc = (uuid, name, type) => ({ uuid, name, type, system: {} });

const item = ({ id, name = "Болтер", type = "weapon", src, baseline } = {}) => ({
  id, name, type,
  system: { cost: 100 },
  _stats: src ? { compendiumSource: src } : {},
  flags: baseline ? { "warhammer-dbc": { contentSync: { baseline } } } : {}
});

describe("itemsNeedingBaseline", () => {
  const bolter = doc("u1", "Болтер", "weapon");
  const index = buildPackIndex([bolter]);

  it("предмет без опоры, но с соответствием в паке — нужна опора", () => {
    const items = [item({ id: "i1", src: "u1" })];
    const need = itemsNeedingBaseline(items, index);
    expect(need.map(x => x.item.id)).toEqual(["i1"]);
    expect(need[0].packDoc).toBe(bolter);
  });

  it("у предмета уже есть опора — пропускаем", () => {
    const items = [item({ id: "i1", src: "u1", baseline: { cost: 100 } })];
    expect(itemsNeedingBaseline(items, index)).toEqual([]);
  });

  it("нет соответствия в паке — не в счёт (нечего опирать)", () => {
    const items = [item({ id: "i1", name: "Самопал" })];
    expect(itemsNeedingBaseline(items, index)).toEqual([]);
  });
});

// wdbc-059h: по образцу gear-equipped/wdbc-dyi — было один try на ВЕСЬ цикл по
// акторам, сбой на одном глушил простановку опоры остальным молча.
describe("stampContentSyncBaseline: изоляция сбоя одного актора (wdbc-059h)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; delete globalThis.foundry; });

  function actorWith(id, items, { throwOnUpdate = false } = {}) {
    return {
      id, name: `Actor ${id}`, items,
      async updateEmbeddedDocuments(type, updates) {
        if (throwOnUpdate) throw new Error(`boom on ${id}`);
        for (const u of updates) {
          const it2 = items.find(i => i.id === u._id);
          if (it2) it2.flags = { "warhammer-dbc": { contentSync: { baseline: u["flags.warhammer-dbc.contentSync.baseline"] } } };
        }
      }
    };
  }

  it("сбой на одном акторе не прерывает простановку остальным и не топит их результат", async () => {
    const bolter = doc("u1", "Болтер", "weapon");
    const bad = actorWith("bad", [item({ id: "i1", src: "u1" })], { throwOnUpdate: true });
    const good = actorWith("good", [item({ id: "i2", src: "u1" })]);

    globalThis.game = {
      user: { isGM: true },
      actors: [bad, good],
      scenes: [],
      packs: { filter: () => [{ documentName: "Item", metadata: { packageName: "warhammer-dbc" }, getDocuments: async () => [bolter] }] }
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
    globalThis.foundry = { utils: { deepClone: (v) => JSON.parse(JSON.stringify(v)) } };

    const res = await stampContentSyncBaseline();

    expect(res.stamped).toBe(1);
    expect(res.failed).toBe(1);
    expect(good.items[0].flags["warhammer-dbc"].contentSync.baseline).toBeTruthy();
    expect(bad.items[0].flags).toEqual({});
  });
});
