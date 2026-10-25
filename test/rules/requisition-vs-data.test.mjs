// test/rules/requisition-vs-data.test.mjs
//
// Реквизиция против НАСТОЯЩИХ данных: таблицы — против книги (core.json, стр. 165),
// признаки предметов — против packs-src, имена Талантов — против паков, кнопка —
// против разметки листа. Фикстуры в requisition.test.mjs — литералы; этот файл
// ловит расхождение литерала с реальностью (AGENTS.md → «Тесты»).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  RARITY_MODS, QUANTITY_TIERS, qualityMod, itemRarity, itemClass, REQUISITION_TALENTS
} from "../../module/rules/requisition.mjs";
import { ITEM_QUALITY_LIST } from "../../module/constants/quality.mjs";
import { allPackDocuments, packDocuments, PACKS_SRC, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Таблицы страницы «Редкость и Качество»: [[ячейки строки]] по таблицам. */
function bookTables() {
  const book = JSON.parse(fs.readFileSync(path.join(PACKS_SRC, "books", "core.json"), "utf8"));
  const found = [];
  const walk = n => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      if (typeof n.html === "string" && n.html.includes("Ubiquitous") && n.html.includes("1001+ предметов")) found.push(n.html);
      for (const k of Object.keys(n)) walk(n[k]);
    }
  };
  walk(book);
  expect(found.length).toBeGreaterThan(0);
  const html = found[0];
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(t =>
    [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r =>
      [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => c[1].replace(/<[^>]+>/g, "").trim())));
}
const num = s => Number(String(s).replace(/[–−—]/g, "-").replace("+", ""));

describe("таблицы реквизиции совпадают со страницей книги", () => {
  const tables = bookTables();
  it("Редкость: 11 строк «Редкость | Название | Мод.»", () => {
    const rarity = tables.find(t => t[0]?.includes("Редкость") && t[0]?.includes("Мод."));
    expect(rarity).toBeTruthy();
    const rows = rarity.slice(1).map(r => [num(r[0]), num(r[2])]);
    expect(rows.length).toBe(11);
    for (const [r, mod] of rows) expect(RARITY_MODS[String(r)], `Редкость ${r}`).toBe(mod);
  });
  it("Количество: те же шесть ступеней", () => {
    const qty = tables.find(t => t[0]?.[0]?.startsWith("Количество"));
    expect(qty).toBeTruthy();
    const mods = qty.slice(1).map(r => num(r[1]));
    expect(mods).toEqual(QUANTITY_TIERS.map(t => t.mod));
    const labels = qty.slice(1).map(r => r[0].replace(/\s+/g, " "));
    expect(labels).toEqual(QUANTITY_TIERS.map(t => t.label));
  });
  it("Качество: Poor/Comm/Good/Best", () => {
    const quality = tables.find(t => t[0]?.includes("Качество") && t[0]?.includes("Название"));
    expect(quality).toBeTruthy();
    const byAbbr = Object.fromEntries(quality.slice(1).map(r => [r[0], num(r[2])]));
    expect(byAbbr).toEqual({ "Poor.Q": qualityMod("poor"), "Comm.Q": qualityMod("common"),
      "Good.Q": qualityMod("good"), "Best.Q": qualityMod("best") });
    expect(ITEM_QUALITY_LIST).toEqual(["poor", "common", "good", "best"]);
  });
});

describe("признаки предметов на настоящих данных packs-src", () => {
  it("экзотическое оружие, легион-оружие, Кибернетика и Записи ритуалов находятся", () => {
    const weapons = packDocuments("weapons", "weapon").map(d => d.doc);
    expect(weapons.filter(w => itemClass(w).exotic).length).toBeGreaterThan(50);
    expect(weapons.filter(w => itemClass(w).legion).length).toBeGreaterThan(50);
    const implants = packDocuments("implants", "implant").map(d => d.doc);
    expect(implants.filter(i => itemClass(i).cybernetic).length).toBeGreaterThan(10);
    const rituals = packDocuments("rituals", "ritual").map(d => d.doc);
    expect(rituals.filter(r => itemClass(r).ritual).length).toBeGreaterThan(5);
  }, PACK_SCAN_TIMEOUT);

  it("у каждого оружия, брони и снаряжения Редкость читается числом в −5…+5", () => {
    const bad = [];
    for (const pack of ["weapons", "armor", "gear", "tools", "ammunition", "shields", "chemistry"]) {
      for (const { file, doc } of allPackDocuments(pack)) {
        const r = itemRarity(doc);
        if (r == null || !Number.isFinite(r) || r < -5 || r > 5) bad.push(`${file}: ${r}`);
      }
    }
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("Импланты без Редкости остаются «без Редкости», а не R0 (решение r0)", () => {
    const implants = packDocuments("implants", "implant").map(d => d.doc);
    const unrated = implants.filter(i => i.system?.availability == null);
    expect(unrated.length).toBeGreaterThan(0);
    expect(unrated.every(i => itemRarity(i) === null)).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});

describe("Таланты реквизиции есть в паках под ожидаемыми именами", () => {
  const talents = packDocuments("talents", "talent").map(d => d.doc);
  for (const [key, def] of Object.entries(REQUISITION_TALENTS)) {
    it(`${key}: ровно один Талант «${def.label}» в паке`, () => {
      const hits = talents.filter(t => def.is(t));
      expect(hits.map(h => h.name)).toHaveLength(1);
    }, PACK_SCAN_TIMEOUT);
  }
});

describe("кнопка «Достать снаряжение» подключена", () => {
  it("в разметке вкладки Снаряжение и среди действий листа", () => {
    const hbs = fs.readFileSync(path.join(ROOT, "templates/actor/parts/tab-gear.hbs"), "utf8");
    expect(hbs).toMatch(/data-action="requisition"/);
    const sheet = fs.readFileSync(path.join(ROOT, "module/sheets/actor-sheet.mjs"), "utf8");
    expect(sheet).toMatch(/requisition:\s*whenEditable\(onRequisition\)/);
    expect(sheet).toMatch(/openRequisition\(this\.actor, this\)/);
  });
});
