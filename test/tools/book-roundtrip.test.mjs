// Круговорот книги: исходник → документы пака → исходник.
//
// Это тот самый шаг CI («Сборка компендиумов ничего не теряет»), который до сих
// пор проверялся только целиком, с LevelDB, и потому не запускался локально при
// открытой Foundry. Здесь та же проверка без баз: bookDocuments и bookSource
// вызываются напрямую на настоящих packs-src/books.
//
// Поводом стала потеря разметки разбора закладок: pdfEnd, level и checked жили в
// исходнике «Машин» у 182 разделов, в пак не ехали и при извлечении пропадали.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { bookDocuments } from "../../tools/book-docs.mjs";
import { bookSource } from "../../tools/book-source.mjs";
import { abs, SRC_ROOT } from "../../tools/packs.mjs";

const BOOKS_DIR = abs(`${SRC_ROOT}/books`);
const slugs = readdirSync(BOOKS_DIR).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
const read = (slug) => JSON.parse(readFileSync(join(BOOKS_DIR, `${slug}.json`), "utf8"));

/** Круговорот без ссылок: индекс пустой, значит linkify ничего не подставит. */
const roundTrip = (data, slug) => bookSource(data, bookDocuments({ slug }, data, new Map()));

describe("круговорот книг: исходник не меняется", () => {
  it("книги вообще есть — иначе проверка пустая", () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it.each(slugs)("%s: сборка и извлечение возвращают тот же исходник", (slug) => {
    const data = read(slug);
    expect(roundTrip(data, slug)).toEqual(data);
  });
});

describe("разметка разбора закладок", () => {
  it("pdfEnd, level и checked переживают круговорот", () => {
    const data = {
      slug: "t", title: "Т", file: "t.pdf", pdfPages: 2,
      entries: [{ name: "Глава", pdfPage: 1, pages: [
        { name: "Раздел", pdfPage: 1, pdfEnd: 2, level: 3, checked: true, html: "<p>текст</p>" }
      ] }]
    };
    expect(roundTrip(data, "t")).toEqual(data);
  });

  it("у книги без разметки поля не появляются", () => {
    // Иначе Хаос, Основная и Пустота обросли бы «level: 1» на ровном месте, и
    // круговорот показал бы правку в каждой из них.
    const data = {
      slug: "t", title: "Т", file: "t.pdf", pdfPages: 1,
      entries: [{ name: "Глава", pdfPage: 1, pages: [
        { name: "Раздел", pdfPage: 1, html: "<p>текст</p>" }
      ] }]
    };
    const back = roundTrip(data, "t");
    expect(back).toEqual(data);
    expect(Object.keys(back.entries[0].pages[0])).toEqual(["name", "pdfPage", "html"]);
  });

  it("checked: false — не то же, что «поля нет»", () => {
    const data = {
      slug: "t", title: "Т", file: "t.pdf", pdfPages: 1,
      entries: [{ name: "Глава", pdfPage: 1, pages: [
        { name: "Раздел", pdfPage: 1, checked: false, html: "" }
      ] }]
    };
    expect(roundTrip(data, "t").entries[0].pages[0].checked).toBe(false);
  });
});
