// test/data/astartes-archetypes-vs-book.test.mjs
//
// АРХЕТИПЫ КОСМОДЕСАНТА (Хавок, Апотекарий, Технодесантник, Изгой, Чародей) —
// ПРОТИВ ТЕКСТА КНИГИ.
//
// Сверка главы I (Архетипы, 28.09.2026). Снаряжение теперь выдаёт Этап 5
// Мастера создания, разбирая строку `gear` (запятая — «И», «или» — выбор):
// значит строка должна совпадать с книгой ДОСЛОВНО, пересказ («Mechanicum
// Implants» вместо трёх предметов Технодесантника, одна строка вместо двух у
// Хавока) молча лишает персонажа снаряжения. Обе стороны читаются разом —
// packs-src/books/core.json и packs-src/archetypes/** (+ резерв-константы),
// правка одной без другой — красный тест.
//
// Черты Архетипа: полный книжный текст в system.benefit документа Черты и
// в system.trait.benefit самого Архетипа. В core.json два огреха вёрстки
// («гено-семенем», «что-бы») — сравнение снимает дефис внутри русского
// слова; когда книгу поправят, нормализация станет пустой.

import "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { packDocuments } from "../support/pack-docs.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { ARCHETYPES } from "../../module/constants/archetypes.mjs";

const BOOK = fs.readFileSync(path.resolve(import.meta.dirname, "../../packs-src/books/core.json"), "utf8");
const html = JSON.parse(BOOK).entries.flatMap(e => e.pages || []).map(p => p.html || "").join("\n");

const strip = s => s.replace(/<[^>]+>/g, "").replace(/­/g, "").replace(/&nbsp;/g, " ").trim();
// «гено-семенем» / «что-бы» — перенос, оставшийся в книге; в Черте пишем слитно.
const norm = s => strip(s).replace(/([а-яё])-([а-яё])/gi, "$1$2").replace(/\s+/g, " ");

/** Раздел Архетипа в книге: от <h1>Имя</h1> до следующего <h1>. */
function bookSection(ruName) {
  const at = html.indexOf(`<h1>${ruName}</h1>`);
  if (at < 0) return "";
  const next = html.indexOf("<h1>", at + 4);
  return html.slice(at, next < 0 ? undefined : next);
}

/** Пункты списка под заголовком <h3>{head}</h3>. */
function listUnder(section, head) {
  const m = section.match(new RegExp(`<h3>${head}</h3>\\s*<ul>(.*?)</ul>`, "s"));
  return m ? [...m[1].matchAll(/<li>(.*?)<\/li>/gs)].map(x => strip(x[1])) : [];
}

function bookArchetype(ruName) {
  const s = bookSection(ruName);
  const traitsAt = s.indexOf("<h3>Трейты:</h3>");
  const tail = traitsAt >= 0 ? s.slice(traitsAt) : "";
  return {
    gear: listUnder(s, "Стартовое Снаряжение:"),
    wounds: strip(s.match(/<h3>Раны:\s*([^<]+)<\/h3>/)?.[1] || ""),
    traitName: strip(tail.match(/<li>(.*?)<\/li>/s)?.[1] || ""),
    benefit: tail.match(/<\/ul>\s*<p[^>]*>(.*?)<\/p>/s)?.[1] || ""
  };
}

const MINE = {
  havoc: "Хавок", apothecary: "Апотекарий", techmarine: "Технодесантник",
  outcast: "Изгой", sorcerer: "Чародей"
};

const archetypes = packDocuments("archetypes", "archetype").map(({ doc }) => doc);
const byKey = key => archetypes.find(d => d.system.key === key);

/** Все записи Конструктора документа, включая вложенные подгруппы. */
function entriesOf(doc) {
  const out = [];
  const walk = g => { for (const e of g?.entries || []) { out.push(e); if (e.kind === "group") walk(e.group); } };
  for (const g of doc.flags?.["warhammer-dbc"]?.mechanics || []) walk(g);
  return out;
}

const traitEntries = doc => entriesOf(doc).filter(e => e.kind === "trait");
const en = name => String(name).split("/")[0].trim();

describe("Архетипы Космодесанта — как в книге", () => {
  for (const [key, ruName] of Object.entries(MINE)) {
    const book = bookArchetype(ruName);

    it(`${ruName}: раздел книги разобран — иначе тест зелен от пустоты`, () => {
      expect(book.gear.length).toBeGreaterThan(0);
      expect(book.wounds).toMatch(/\d+\+1d5/);
      expect(book.traitName).toMatch(/\//);
      expect(book.benefit.length).toBeGreaterThan(40);
    });

    it(`${ruName}: строка снаряжения — дословно книжная (Этап 5 Мастера её разбирает)`, () => {
      const doc = byKey(key);
      expect(doc, `нет Архетипа ${key}`).toBeTruthy();
      expect(doc.system.gear).toBe(book.gear.join(", "));
      expect(ARCHETYPES[key].gear).toBe(book.gear.join(", "));
    });

    it(`${ruName}: Раны как в книге`, () => {
      expect(byKey(key).system.wounds).toBe(book.wounds);
      expect(ARCHETYPES[key].wounds).toBe(book.wounds);
    });

    it(`${ruName}: Черта Архетипа — книжное имя и полный текст`, () => {
      const doc = byKey(key);
      expect(en(doc.system.trait.name)).toBe(en(book.traitName));
      expect(norm(doc.system.trait.benefit)).toBe(norm(book.benefit));
      expect(norm(ARCHETYPES[key].trait.benefit)).toBe(norm(book.benefit));
      // Черту выдаёт Конструктор, и документ Черты несёт тот же текст.
      const entry = traitEntries(doc).find(e => en(e.sourceName) === en(book.traitName));
      expect(entry, `Архетип не выдаёт Черту ${book.traitName}`).toBeTruthy();
      const id = entry.sourceUuid.split(".").pop();
      const trait = packDocById("packs-src/traits", id);
      expect(en(trait.name)).toBe(en(book.traitName));
      expect(norm(trait.system.benefit)).toBe(norm(book.benefit));
    });

    it(`${ruName}: бонусных Характеристик и лишних Ран книга не даёт`, () => {
      const doc = byKey(key);
      expect(doc.system.charBonus).toEqual({});
      expect(ARCHETYPES[key].charBonus).toEqual({});
      const extra = entriesOf(doc).filter(e => e.kind === "characteristic" || e.kind === "wounds");
      expect(extra.map(e => `${e.kind}:${e.charKey}:${e.woundsValue}`)).toEqual([]);
    });
  }

  it("Чародей: Стартовый Трейт Psyker И Черта Sorcerer, +1d10 стартовой Порчи, Связанный", () => {
    const doc = byKey("sorcerer");
    const names = traitEntries(doc).map(e => en(e.sourceName));
    expect(names).toContain("Psyker");
    expect(names).toContain("Sorcerer");
    const cor = entriesOf(doc).filter(e => e.kind === "corruption");
    expect(cor.map(e => [e.op, e.corruptionValue])).toEqual([["add", "1d10"]]);
    expect(doc.system.psykerClass).toBe("bound");
    expect(doc.system.isPsyker).toBe(true);
  });

  it("Технодесантник: Импланты Механикум выдаются (grantsImplants), знание — Механикум", () => {
    const doc = byKey("techmarine");
    expect(doc.system.grantsImplants).toBe(true);
    const fl = entriesOf(doc).find(e => e.kind === "skill" && e.skillKey === "forbiddenLore");
    expect(fl.specKey).toBe("mechanicum");
  });

  // Мехадендрит выдаёт Этап 5 Мастера по тексту gear (записи Конструктора
  // со снаряжением сняты — двойная выдача, сверка Архетипов 28.09.2026).
  it("Технодесантник: Мехадендрит — «R3 или R2 Good.Q», как в книге", () => {
    const doc = byKey("techmarine");
    expect(doc.system.gear).toContain("1 Мехадендрит (R3 или R2 Good.Q)");
    expect(entriesOf(doc).some(e => e.kind === "equipment" && e.equipImplantCategory === "mechadendrite")).toBe(false);
  });
});
