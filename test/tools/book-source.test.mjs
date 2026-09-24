import { describe, it, expect } from "vitest";
import { bookSource } from "../../tools/book-source.mjs";
import { bookDocuments } from "../../tools/book-docs.mjs";

const book = { slug: "core", pack: "book-core" };

// Документы в том виде, в каком они лежат в компендиуме: порядок задан sort,
// ссылки уже расставлены, названия книги и страницы PDF — во флагах.
const docs = [
  {
    _id: "EntryMechanics01", name: "II. МЕХАНИКА", sort: 200,
    flags: { "warhammer-dbc": { book: "core", pdfPage: 40, source: "DoomBC_Core.pdf" } },
    pages: [
      { _id: "PageTestsId00001", name: "Тесты", sort: 200, text: { content: "<p>Второй.</p>" },
        flags: { "warhammer-dbc": { book: "core", pdfPage: 42 } } },
      { _id: "PageMoveId000001", name: "Движение", sort: 100, text: { content: "<p>Первый.</p>" },
        flags: { "warhammer-dbc": { book: "core", pdfPage: 41 } } }
    ]
  },
  {
    _id: "EntryIntroId0001", name: "ВСТУПЛЕНИЕ", sort: 100,
    flags: { "warhammer-dbc": { book: "core", pdfPage: 2, source: "DoomBC_Core.pdf" } },
    pages: [
      { _id: "PageIntroId00001", name: "Вступление", sort: 100,
        text: { content: "<p>Стреляет @UUID[Compendium.warhammer-dbc.weapons.Item.aaa]{Болт-пистолет}.</p>" },
        flags: { "warhammer-dbc": { book: "core", pdfPage: 2 } } }
    ]
  }
];

const existing = { slug: "core", title: "Основная книга", file: "DoomBC_Core.pdf", pdfPages: 506, entries: [] };

describe("bookSource", () => {
  it("описание книги остаётся прежним", () => {
    expect(bookSource(existing, docs)).toMatchObject({
      slug: "core", title: "Основная книга", file: "DoomBC_Core.pdf", pdfPages: 506
    });
  });

  it("главы и разделы выстраиваются по sort", () => {
    const src = bookSource(existing, docs);
    expect(src.entries.map(e => e.name)).toEqual(["ВСТУПЛЕНИЕ", "II. МЕХАНИКА"]);
    expect(src.entries[1].pages.map(p => p.name)).toEqual(["Движение", "Тесты"]);
  });

  it("страница PDF берётся из флагов", () => {
    const src = bookSource(existing, docs);
    expect(src.entries[0].pdfPage).toBe(2);
    expect(src.entries[1].pages[1].pdfPage).toBe(42);
  });

  it("ссылки @UUID снимаются: их расставляет сборка", () => {
    const [chapter] = bookSource(existing, docs).entries;
    expect(chapter.pages[0].html).toBe("<p>Стреляет Болт-пистолет.</p>");
  });

  // Круговорот: собрать из исходника документы и разобрать их обратно.
  // Расходятся — значит сборка релиза потеряет часть книги.
  it("сборка из полученного исходника даёт те же главы, разделы и текст", () => {
    const src = bookSource(existing, docs);
    const rebuilt = bookDocuments(book, src, new Map());
    expect(bookSource(existing, rebuilt)).toEqual(src);
  });

  // wdbc-bjy1.10: замороженный _id едет в исходник и обратно в сборку.
  it("_id глав и разделов переживает извлечение и повторную сборку", () => {
    const src = bookSource(existing, docs);
    expect(src.entries.map(e => e._id)).toEqual(["EntryIntroId0001", "EntryMechanics01"]);
    expect(src.entries[1].pages.map(pg => pg._id)).toEqual(["PageMoveId000001", "PageTestsId00001"]);
    const rebuilt = bookDocuments(book, src, new Map());
    expect(rebuilt[1].pages.map(pg => pg._id)).toEqual(["PageMoveId000001", "PageTestsId00001"]);
  });
});
