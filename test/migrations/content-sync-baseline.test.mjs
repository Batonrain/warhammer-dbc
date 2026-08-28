// test/migrations/content-sync-baseline.test.mjs
//
// Бутстрап опоры «Обновить мир»: у предметов без flags.contentSync.baseline,
// но с соответствием в паке, опору нужно поставить; у остальных — не трогать.

import { describe, it, expect } from "vitest";
import { itemsNeedingBaseline } from "../../module/migrations/content-sync-baseline.mjs";
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
