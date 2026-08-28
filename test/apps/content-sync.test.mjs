// test/apps/content-sync.test.mjs
//
// «Обновить мир»: сопоставление предмета актёра с документом пака и
// трёхсторонний диффинг (опора/актёр/пак) без жёсткого списка полей по типу.

import { describe, it, expect } from "vitest";
import {
  nameKeys, sameValue, buildPackIndex, matchPackSource,
  diffItemAgainstPack, buildSyncReport, applySyncReport
} from "../../module/apps/content-sync.mjs";

const doc = (uuid, name, type, system = {}) => ({ uuid, name, type, system });

const item = ({ id = "i1", name = "Штука", type = "gear", system = {}, src, baseline } = {}) => ({
  id, name, type, system,
  _stats: src ? { compendiumSource: src } : {},
  flags: baseline ? { "warhammer-dbc": { contentSync: { baseline } } } : {}
});

describe("nameKeys", () => {
  it("полное имя без регистра + обе половины двуязычного", () => {
    expect(nameKeys("Sword / Меч")).toEqual(["sword / меч", "sword", "меч"]);
  });
  it("без разделителя — только целиком", () => {
    expect(nameKeys("Болтер")).toEqual(["болтер"]);
  });
  it("пусто — пустой список", () => { expect(nameKeys("")).toEqual([]); });
});

describe("sameValue", () => {
  it("примитивы и NaN-безопасность", () => {
    expect(sameValue(1, 1)).toBe(true);
    expect(sameValue(1, "1")).toBe(false);
    expect(sameValue(null, undefined)).toBe(false);
  });
  it("массивы и объекты — по глубине, без учёта порядка ключей", () => {
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue([1, { x: 1 }], [1, { x: 1 }])).toBe(true);
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false);
    expect(sameValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("matchPackSource", () => {
  it("сперва по compendiumSource", () => {
    const sword = doc("Compendium...s1", "Sword / Меч", "weapon");
    const index = buildPackIndex([sword]);
    expect(matchPackSource(item({ src: sword.uuid, name: "Другое", type: "weapon" }), index)).toBe(sword);
  });
  it("откат на имя, любую половину, без учёта регистра — но только внутри своего типа", () => {
    const sword = doc("u1", "Sword / Меч", "weapon");
    const index = buildPackIndex([sword]);
    expect(matchPackSource(item({ name: "меч", type: "weapon" }), index)).toBe(sword);
    expect(matchPackSource(item({ name: "SWORD", type: "weapon" }), index)).toBe(sword);
    expect(matchPackSource(item({ name: "Меч", type: "gear" }), index)).toBe(null);
  });
  it("нет соответствия — null", () => {
    const index = buildPackIndex([doc("u1", "Sword / Меч", "weapon")]);
    expect(matchPackSource(item({ name: "Самопал" }), index)).toBe(null);
  });
});

describe("diffItemAgainstPack", () => {
  it("пак не менял поле относительно опоры — не показываем, даже если поле правили локально", () => {
    const pack = doc("u1", "Болтер", "weapon", { dmg: "1d10+4", cost: 100 });
    const it1 = item({ system: { dmg: "1d10+4", cost: 999 }, baseline: { dmg: "1d10+4", cost: 100 } });
    expect(diffItemAgainstPack(it1, pack)).toEqual([]);
  });

  it("пак изменил поле, актёр не трогал (== опоре) — clean", () => {
    const pack = doc("u1", "Болтер", "weapon", { dmg: "1d10+5" });
    const it1 = item({ system: { dmg: "1d10+4" }, baseline: { dmg: "1d10+4" } });
    const diffs = diffItemAgainstPack(it1, pack);
    expect(diffs).toEqual([{ path: "dmg", baseVal: "1d10+4", actorVal: "1d10+4", packVal: "1d10+5", status: "clean" }]);
  });

  it("пак изменил поле, актёр тоже отклонился от опоры — conflict", () => {
    const pack = doc("u1", "Болтер", "weapon", { dmg: "1d10+5" });
    const it1 = item({ system: { dmg: "1d10+9 (ГМ)" }, baseline: { dmg: "1d10+4" } });
    const diffs = diffItemAgainstPack(it1, pack);
    expect(diffs[0].status).toBe("conflict");
  });

  it("нет опоры вовсе (предмет новее фичи) — опора = текущее, первое расхождение clean", () => {
    const pack = doc("u1", "Болтер", "weapon", { cost: 150 });
    const it1 = item({ system: { cost: 100 } }); // без baseline
    const diffs = diffItemAgainstPack(it1, pack);
    expect(diffs).toEqual([{ path: "cost", baseVal: 100, actorVal: 100, packVal: 150, status: "clean" }]);
  });

  it("нет документа пака — пусто", () => {
    expect(diffItemAgainstPack(item(), null)).toEqual([]);
  });
});

describe("buildSyncReport / applySyncReport", () => {
  const pack = doc("u1", "Болтер", "weapon", { dmg: "1d10+5", cost: 150 });
  const index = buildPackIndex([pack]);

  const actorA = {
    id: "a1", name: "Актёр А",
    items: [item({ id: "i1", name: "Болтер", type: "weapon", src: "u1", system: { dmg: "1d10+4", cost: 100 }, baseline: { dmg: "1d10+4", cost: 100 } })]
  };
  const actorB = {
    id: "a2", name: "Актёр Б",
    items: [item({ id: "i2", name: "Болтер", type: "weapon", src: "u1", system: { dmg: "1d10+9 (ГМ)", cost: 100 }, baseline: { dmg: "1d10+4", cost: 100 } })]
  };
  const actorC = {
    id: "a3", name: "Актёр В",
    items: [item({ id: "i3", name: "Самопал", type: "weapon", system: { dmg: "1d5" } })]
  };

  it("группирует по (пак, поле), несопоставленные — отдельно", () => {
    const report = buildSyncReport([actorA, actorB, actorC], index);
    expect(report.unmatched).toEqual([{
      actorId: "a3", actorName: "Актёр В", itemId: "i3", itemName: "Самопал",
      itemType: "weapon", itemTypeLabel: "Оружие"
    }]);
    const dmgRow = report.rows.find(r => r.path === "dmg");
    expect(dmgRow.entries.map(e => e.status).sort()).toEqual(["clean", "conflict"]);
    const costRow = report.rows.find(r => r.path === "cost");
    expect(costRow.entries).toHaveLength(2);
    expect(costRow.entries.every(e => e.status === "clean")).toBe(true);
  });

  it("применяет только отмеченные записи, конфликт по умолчанию не трогает", async () => {
    const report = buildSyncReport([actorA, actorB], index);
    const dmgRow = report.rows.find(r => r.path === "dmg");
    const cleanEntry = dmgRow.entries.find(e => e.status === "clean");
    const conflictEntry = dmgRow.entries.find(e => e.status === "conflict");

    const updateCalls = [];
    globalThis.game = {
      actors: {
        get: id => ({
          id,
          updateEmbeddedDocuments: async (docType, updates) => updateCalls.push({ id, docType, updates })
        })
      }
    };

    const result = await applySyncReport(report, new Set([cleanEntry.entryKey]));
    expect(result).toEqual({ actors: 1, items: 1 });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].updates).toEqual([{
      _id: cleanEntry.itemId,
      "system.dmg": "1d10+5",
      "flags.warhammer-dbc.contentSync.baseline.dmg": "1d10+5"
    }]);
    expect(conflictEntry).toBeTruthy(); // конфликт остался неотмеченным — не в updateCalls
  });
});
