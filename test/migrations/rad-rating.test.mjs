// test/migrations/rad-rating.test.mjs
//
// Rad (X) (rad-x-956a): кнопка Рад берёт рейтинг из system.weaponProps — у
// записи {key:"rad"} должно быть поле rating («1d5»). Пак поправлен 02.10.2026
// (696ae7745, 12 предметов), но копии на живых акторах — снимки момента
// выдачи: у них {key:"rad"} без рейтинга, и вместо урона в T приходит
// «не задан рейтинг Рад (X)». Миграция догоняет копии по паку.
//
// Данные — настоящие JSON packs-src (weapons, vehicle-weapons): копия «до
// правки» получается из записи пака снятием рейтинга, как было до 696ae7745.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { radRatingOf, radRatingPatch, radRatingUpdates, buildRadIndex }
  from "../../module/migrations/rad-rating.mjs";
import { diffItemAgainstPack } from "../../module/apps/content-sync.mjs";

const PACKS = ["weapons", "vehicle-weapons"];

/** Документы паков в том виде, в каком их отдаёт getDocuments(): с uuid. */
function packDocs() {
  return allPackDocuments(PACKS).map(({ file, doc }) => {
    const pack = file.replaceAll("\\", "/").split("/")[0];
    return { ...doc, uuid: `Compendium.warhammer-dbc.${pack}.Item.${doc._id}` };
  });
}

const DOCS = packDocs();
const INDEX = buildRadIndex(DOCS);
const RAD_DOCS = DOCS.filter(d => radRatingOf(d));

/** Копия на акторе до правки пака: та же запись, у Рад нет рейтинга. */
function staleCopy(doc, { withSource = true, name = doc.name, id = "it1" } = {}) {
  const system = structuredClone(doc.system);
  system.weaponProps = system.weaponProps.map(p => p.key === "rad" ? { key: "rad" } : p);
  return {
    id, type: doc.type, name, system, flags: {},
    _stats: withSource ? { compendiumSource: doc.uuid } : {}
  };
}

const byEn = en => RAD_DOCS.find(d => d.name.split("/")[0].trim() === en);
const radOf = item => item.system.weaponProps.find(p => p.key === "rad");

/** Наложить плоский патч обновления на копию (как сделал бы Foundry). */
function applyPatch(item, patch) {
  for (const [path, v] of Object.entries(patch)) {
    const keys = path.split(".");
    let o = item;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;
  }
  return item;
}

describe("Пак: у кого Рад и с каким рейтингом", () => {
  it("12 предметов с рейтингом-формулой, ровно 1d5/1d10/2d10/4d10", () => {
    expect(RAD_DOCS).toHaveLength(12);
    expect(new Set(RAD_DOCS.map(radRatingOf))).toEqual(new Set(["1d5", "1d10", "2d10", "4d10"]));
  }, PACK_SCAN_TIMEOUT);
});

describe("Копия, выданная до правки пака", () => {
  it("каждая из 12 копий (по uuid источника) получает рейтинг своей записи пака", () => {
    for (const doc of RAD_DOCS) {
      const item = staleCopy(doc);
      const patch = radRatingPatch(item, INDEX);
      expect(patch, doc.name).not.toBeNull();
      applyPatch(item, patch);
      expect(radOf(item).rating, doc.name).toBe(radRatingOf(doc));
    }
  });

  it("остальные свойства оружия не тронуты и порядок тот же", () => {
    const doc = byEn("Irrad Cleanser");
    const item = staleCopy(doc);
    applyPatch(item, radRatingPatch(item, INDEX));
    expect(item.system.weaponProps.map(p => p.key)).toEqual(doc.system.weaponProps.map(p => p.key));
    expect(item.system.weaponProps).toEqual(doc.system.weaponProps);
  });

  it("без uuid источника — по имени, в любом порядке половин", () => {
    const pistol = byEn("Radium Pistol");
    expect(radOf(applyPatch(staleCopy(pistol, { withSource: false }),
      radRatingPatch(staleCopy(pistol, { withSource: false }), INDEX))).rating).toBe("1d5");
    const ru = staleCopy(pistol, { withSource: false, name: "Радиевый Пистолет / Radium Pistol" });
    expect(radOf(applyPatch(ru, radRatingPatch(ru, INDEX))).rating).toBe("1d5");
  });

  it("граната «Rad / Рад» — 2d10, ракета «Rad / Ракета: Рад» — 4d10 (общая половина «Rad» не путает)", () => {
    const grenade = DOCS.find(d => d.name === "Rad / Рад");
    const missile = DOCS.find(d => d.name === "Rad / Ракета: Рад");
    for (const [doc, want] of [[grenade, "2d10"], [missile, "4d10"]]) {
      const item = staleCopy(doc, { withSource: false });
      expect(radOf(applyPatch(item, radRatingPatch(item, INDEX))).rating).toBe(want);
    }
  });

  it("uuid источника решает и там, где имя бессильно: «Rad» с uuid ракеты — 4d10, переименованный карабин — 1d5", () => {
    const missile = DOCS.find(d => d.name === "Rad / Ракета: Рад");
    const rad = staleCopy(missile, { name: "Rad" });
    expect(radOf(applyPatch(rad, radRatingPatch(rad, INDEX))).rating).toBe("4d10");
    const renamed = staleCopy(byEn("Radium Carbine"), { name: "Карабин сержанта Вокса" });
    expect(radOf(applyPatch(renamed, radRatingPatch(renamed, INDEX))).rating).toBe("1d5");
  });

  it("снимки «до» Оружия Наследия и Демонического Оружия догоняются тем же рейтингом", () => {
    const doc = byEn("Radium Pistol");
    const item = staleCopy(doc);
    const stale = structuredClone(item.system.weaponProps);
    item.system.legacy = { preProps: structuredClone(stale) };
    item.system.daemonWeapon = { preProps: structuredClone(stale) };
    applyPatch(item, radRatingPatch(item, INDEX));
    for (const list of [item.system.weaponProps, item.system.legacy.preProps, item.system.daemonWeapon.preProps])
      expect(list.find(p => p.key === "rad").rating).toBe("1d5");
  });

  it("свойства уже с рейтингом, а снимок Наследия без — правится только снимок", () => {
    const doc = byEn("Radium Pistol");
    const item = staleCopy(doc);
    item.system.legacy = { preProps: structuredClone(item.system.weaponProps) };
    radOf(item).rating = "1d5";
    expect(Object.keys(radRatingPatch(item, INDEX))).toEqual(["system.legacy.preProps"]);
  });

  it("имя просто «Rad» без источника — неоднозначно (2d10 или 4d10), не трогаем", () => {
    const item = staleCopy(DOCS.find(d => d.name === "Rad / Рад"), { withSource: false, name: "Rad" });
    expect(radRatingPatch(item, INDEX)).toBeNull();
  });

  it("пустая строка и «0» вместо рейтинга — тоже «не задан»", () => {
    for (const rating of ["", "0", 0, null]) {
      const item = staleCopy(byEn("Radium Carbine"));
      radOf(item).rating = rating;
      expect(radRatingPatch(item, INDEX), String(rating)).not.toBeNull();
    }
  });

  it("рейтинг, вписанный ГМом, не перетирается", () => {
    const item = staleCopy(byEn("Radium Carbine"));
    radOf(item).rating = "2d5";
    expect(radRatingPatch(item, INDEX)).toBeNull();
  });

  it("идемпотентна: второй прогон копию не трогает", () => {
    const item = staleCopy(byEn("Transuranic Arqebus"));
    applyPatch(item, radRatingPatch(item, INDEX));
    expect(radRatingPatch(item, INDEX)).toBeNull();
  });

  it("оружие без Рад и предмет не того типа — не трогаем", () => {
    const plain = DOCS.find(d => d.type === "weapon" && !d.system.weaponProps?.some(p => p.key === "rad"));
    expect(radRatingPatch({ ...structuredClone(plain), _stats: { compendiumSource: plain.uuid } }, INDEX)).toBeNull();
    const notWeapon = { ...staleCopy(byEn("Radium Pistol")), type: "gear" };
    expect(radRatingPatch(notWeapon, INDEX)).toBeNull();
  });

  it("копия, которой нет в паке (собрана руками), — не трогаем", () => {
    const item = staleCopy(byEn("Radium Pistol"), { withSource: false, name: "Самопальный Облучатель" });
    expect(radRatingPatch(item, INDEX)).toBeNull();
  });
});

describe("«Обновить мир» после миграции не показывает ложного конфликта", () => {
  it("опора weaponProps догоняется тем же рейтингом — строки по полю нет", () => {
    const doc = byEn("Radium Serpenta");
    const item = staleCopy(doc);
    // Опора проставлена миграцией content-sync-baseline ещё до правки пака.
    item.flags = { "warhammer-dbc": { contentSync: { baseline: { weaponProps: structuredClone(item.system.weaponProps) } } } };
    applyPatch(item, radRatingPatch(item, INDEX));
    expect(item.flags["warhammer-dbc"].contentSync.baseline.weaponProps).toEqual(item.system.weaponProps);
    expect(diffItemAgainstPack(item, doc).filter(d => d.path === "weaponProps")).toEqual([]);
  });

  it("опоры нет — её и не заводим", () => {
    const item = staleCopy(byEn("Radium Serpenta"));
    const patch = radRatingPatch(item, INDEX);
    expect(Object.keys(patch)).toEqual(["system.weaponProps"]);
  });
});

describe("Сбор обновлений по актору", () => {
  it("правит только копии, которым нужно, — одним списком на updateEmbeddedDocuments", () => {
    const items = [
      staleCopy(byEn("Radium Pistol"), { id: "a" }),
      { ...staleCopy(byEn("Radium Carbine"), { id: "b" }) },
      staleCopy(DOCS.find(d => d.name === "Rad / Ракета: Рад"), { id: "c" })
    ];
    radOf(items[1]).rating = "1d10";               // ГМ уже вписал
    const updates = radRatingUpdates(items, INDEX);
    expect(updates.map(u => u._id)).toEqual(["a", "c"]);
    expect(updates[1]["system.weaponProps"].find(p => p.key === "rad").rating).toBe("4d10");
  });
});
