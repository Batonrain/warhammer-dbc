// test/data/race-archetypes-vs-book.test.mjs
//
// ДОСТУПНЫЕ АРХЕТИПЫ И СТАРТОВАЯ ПОРЧА РАС — ПРОТИВ ТЕКСТА КНИГИ.
//
// Повод — сверка главы I (Огрин…Йигори). В книге у каждой расы-недочеловека
// свой список: «Огрин получает доступ к следующим Архетипам Людей: Ренегат,
// Пират, и Дикарь». Система этого не знала вовсе: archetypesForRace отдавала
// любой не-эльдарской расе полный список Людей, и Огрин мог стать Ведьмой.
// Столбца Cor таблицы «Стартовые Характеристики» (Зверолюд, Гарпия, Нага — 5)
// в данных расы не было совсем.
//
// Обе стороны читаются разом, как у race-traits-vs-book: из
// packs-src/books/core.json и из packs-src/races/**. Правка любой из них без
// другой — красный тест.

import "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { packDocuments } from "../support/pack-docs.mjs";
import { archetypesForRace } from "../../module/apps/archetypes.mjs";
import { raceCorruptionUpdate } from "../../module/apps/races.mjs";
import { RACES } from "../../module/constants/races.mjs";

const BOOK = fs.readFileSync(path.resolve(import.meta.dirname, "../../packs-src/books/core.json"), "utf8");
const html = JSON.parse(BOOK).entries.flatMap(e => e.pages || []).map(p => p.html || "").join("\n");

// Русское имя Архетипа Людей в книге → ключ записи в packs-src/archetypes.
// «Демонолог» книги — это heresiarch пака (тот же +5 I/+2 W, Лидер Культа).
const ARCH_KEY = {
  "Отступник": "apostate", "Демонолог": "heresiarch", "Ренегат": "renegade",
  "Пират": "pirate", "Дикарь": "savage", "Благородный": "noble",
  "Ведьма": "witch", "Нумен": "numen", "Скитарий": "skitarii",
  "Еретех": "heretek", "Беглый Псайкер": "renegadePsyker"
};

const strip = s => s.replace(/<[^>]+>/g, "").replace(/­/g, "").trim();

/** «Огрин получает доступ к следующим Архетипам Людей:» → ["Ренегат", …]. */
function bookArchetypes() {
  const out = {};
  const re = /<p>([^<]+?) получает доступ к следующим Архетипам Людей:<\/p>\s*<ul>(.*?)<\/ul>/gs;
  for (const m of html.matchAll(re)) {
    const items = [...m[2].matchAll(/<li>(.*?)<\/li>/gs)].map(x => strip(x[1]));
    out[strip(m[1])] = items;
  }
  return out;
}

/** Стартовая Cor расы из таблицы: 10-я ячейка строки чисел под «WS … Inf». */
function bookCor(raceRu) {
  const at = html.indexOf(`<h1>${raceRu}</h1>`);
  if (at < 0) return null;
  const tbl = html.slice(at).match(/<table>(.*?)<\/table>/s)?.[1] || "";
  const rows = [...tbl.matchAll(/<tr>(.*?)<\/tr>/gs)].map(r => [...r[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(c => strip(c[1])));
  const nums = rows.find(r => r.length === 11 && r.every(c => /^\d+$/.test(c)));
  return nums ? Number(nums[9]) : null;
}

const races = packDocuments("races", "race").map(({ doc }) => doc);
const ruName = doc => doc.name.split("/")[1].trim();

describe("Архетипы рас — как в книге", () => {
  const book = bookArchetypes();

  it("книга разобрана — иначе тест зелен от пустоты", () => {
    expect(Object.keys(book).length).toBeGreaterThanOrEqual(9);
  });

  for (const [raceRu, names] of Object.entries(bookArchetypes())) {
    it(`${raceRu}: список Архетипов в паке совпадает с книгой`, () => {
      const doc = races.find(d => ruName(d) === raceRu);
      expect(doc, `нет расы «${raceRu}» в packs-src/races`).toBeTruthy();
      const want = names.map(n => ARCH_KEY[n]);
      expect(want.every(Boolean), `неизвестный Архетип в книге: ${names}`).toBe(true);
      expect([...doc.system.archetypes].sort()).toEqual([...want].sort());
      // Резерв-константа (мир без пака, тесты) обязана давать то же самое.
      expect([...(RACES[doc.system.key]?.archetypes || [])].sort()).toEqual([...want].sort());
    });
  }
});

describe("archetypesForRace: книжный список расы", () => {
  const keys = race => archetypesForRace(race).map(([k]) => k).sort();

  it("Огрин — только Ренегат, Пират, Дикарь", () => {
    expect(keys("ogryn")).toEqual(["pirate", "renegade", "savage"]);
  });

  it("Репликант — среди прочих Скитарий, но не Ведьма", () => {
    expect(keys("replicant")).toContain("skitarii");
    expect(keys("replicant")).not.toContain("witch");
  });

  it("Человек без списка — все Архетипы Людей, как раньше", () => {
    expect(keys("human").length).toBeGreaterThan(keys("yigori").length);
    expect(keys("human")).toContain("renegadePsyker");
  });
});

describe("Стартовая Порча рас — столбец Cor книги", () => {
  for (const doc of races.filter(d => d.system.group !== "Аэльдари")) {
    const cor = bookCor(ruName(doc));
    if (cor == null) continue;
    it(`${ruName(doc)}: Cor ${cor}`, () => {
      expect(Number(doc.system.startCorruption) || 0).toBe(cor);
      expect(Number(RACES[doc.system.key]?.startCorruption) || 0).toBe(cor);
    });
  }

  it("раса кладёт Порчу только в пустой счётчик", () => {
    const fresh = { system: { corruption: { value: 0 } } };
    const used  = { system: { corruption: { value: 12 } } };
    expect(raceCorruptionUpdate(fresh, 5)).toEqual({ "system.corruption.value": 5 });
    expect(raceCorruptionUpdate(used, 5)).toEqual({});
    expect(raceCorruptionUpdate(fresh, 0)).toEqual({});
  });
});
