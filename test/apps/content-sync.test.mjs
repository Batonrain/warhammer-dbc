// test/apps/content-sync.test.mjs
//
// «Обновить мир»: сопоставление предмета актёра с документом пака и
// трёхсторонний диффинг (опора/актёр/пак) без жёсткого списка полей по типу.

import { describe, it, expect } from "vitest";
import {
  nameKeys, sameValue, buildPackIndex, matchPackSource,
  diffItemAgainstPack, buildSyncReport, applySyncReport,
  MECH_PATH, fieldLabel, describeValue
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


// ── wdbc-lddr: Механика из пака доезжает до уже созданных персонажей ────────
//
// Механика предмета живёт не в system, а во flags.warhammer-dbc.mechanics —
// и сверка её не видела вовсе. Из-за этого у персонажа, созданного ДО правки,
// Талант обновлял ОПИСАНИЕ («МЕХАНИЗИРОВАНО», system.notes в сверку входит) и
// не получал самой механики: текст на листе утверждал то, чего в предмете нет.
//
// Механика — такое же поле со своей опорой, как и любое поле system: правка,
// сделанная ГМом на конкретном предмете актёра, отличима от паковой и уходит
// в «конфликт», а не затирается молча.

const mech = label => [{ id: "g1", operator: "AND", entries: [{ id: "e1", kind: "testMod", label }] }];

/** Предмет с механикой (и, возможно, со своей опорой механики). */
const mechItem = ({ id = "m1", name = "Талант", type = "talent", system = {},
                    src, mechanics, mechBaseline } = {}) => {
  const flags = { "warhammer-dbc": {} };
  if (mechanics) flags["warhammer-dbc"].mechanics = mechanics;
  if (mechBaseline) flags["warhammer-dbc"].contentSync = { mechanicsBaseline: mechBaseline };
  return { id, name, type, system, _stats: src ? { compendiumSource: src } : {}, flags };
};

const mechDoc = (uuid, name, type, mechanics, system = {}) =>
  ({ uuid, name, type, system, flags: { "warhammer-dbc": { mechanics } } });

describe("Механика Конструктора участвует в сверке (wdbc-lddr)", () => {
  it("у персонажа механики нет, в паке появилась — строка «чисто», применимо", () => {
    const pack = mechDoc("u9", "Боевое Построение", "talent", mech("Построение"));
    const it0  = mechItem({ src: "u9", name: "Боевое Построение" });
    const diff = diffItemAgainstPack(it0, pack);
    const row  = diff.find(d => d.path === MECH_PATH);
    expect(row).toBeTruthy();
    expect(row.status).toBe("clean");
    expect(row.packVal).toEqual(mech("Построение"));
  });

  it("механика совпадает с паком — строки нет вовсе", () => {
    const pack = mechDoc("u9", "Боевое Построение", "talent", mech("Построение"));
    const it0  = mechItem({ src: "u9", mechanics: mech("Построение") });
    expect(diffItemAgainstPack(it0, pack).find(d => d.path === MECH_PATH)).toBeUndefined();
  });

  it("ГМ правил механику на предмете актёра — конфликт, а не молчаливое затирание", () => {
    const pack = mechDoc("u9", "Боевое Построение", "talent", mech("Построение"));
    const it0  = mechItem({
      src: "u9",
      mechanics:    mech("Правка ГМа"),
      mechBaseline: mech("Старое паковое")
    });
    const row = diffItemAgainstPack(it0, pack).find(d => d.path === MECH_PATH);
    expect(row.status).toBe("conflict");
    expect(row.actorVal).toEqual(mech("Правка ГМа"));
  });

  it("в паке механики нет и у предмета нет — не показываем пустое расхождение", () => {
    const pack = doc("u8", "Простая Черта", "trait", { notes: "текст" });
    const it0  = mechItem({ src: "u8", type: "trait" });
    expect(diffItemAgainstPack(it0, pack).find(d => d.path === MECH_PATH)).toBeUndefined();
  });

  it("механику из пака СНЯЛИ — предмету тоже предлагается снять", () => {
    const pack = doc("u7", "Черта", "trait", {});
    const it0  = mechItem({ src: "u7", type: "trait", mechanics: mech("Устаревшее") });
    const row = diffItemAgainstPack(it0, pack).find(d => d.path === MECH_PATH);
    expect(row).toBeTruthy();
    expect(row.packVal).toEqual([]);
  });

  it("применение пишет саму механику и продвигает её опору", async () => {
    const pack  = mechDoc("u9", "Боевое Построение", "talent", mech("Построение"));
    const index = buildPackIndex([pack]);
    const actor = { id: "a9", name: "Ветеран", items: [mechItem({ id: "m9", name: "Боевое Построение", src: "u9" })] };
    const report = buildSyncReport([actor], index);
    const row = report.rows.find(r => r.path === MECH_PATH);
    expect(row).toBeTruthy();

    const updateCalls = [];
    globalThis.game = {
      actors: { get: id => ({ id, updateEmbeddedDocuments: async (t, u) => updateCalls.push({ id, t, u }) }) }
    };
    await applySyncReport(report, new Set([row.entries[0].entryKey]));
    expect(updateCalls[0].u).toEqual([{
      _id: "m9",
      "flags.warhammer-dbc.mechanics": mech("Построение"),
      "flags.warhammer-dbc.contentSync.mechanicsBaseline": mech("Построение")
    }]);
  });

  it("подпись поля в окне — человеческая, а не имя флага", () => {
    expect(fieldLabel(MECH_PATH)).not.toContain("flags");
    expect(fieldLabel(MECH_PATH)).toMatch(/МЕХАНИКА|Механика/);
    expect(fieldLabel("notes")).toBe("notes");
  });

  it("значение Механики показывается сводкой, а не простынёй JSON", () => {
    const shown = describeValue(MECH_PATH, mech("Построение"));
    expect(shown).not.toContain("{");
    expect(shown).toContain("1");
    expect(describeValue(MECH_PATH, [])).toBe("—");
  });
});
