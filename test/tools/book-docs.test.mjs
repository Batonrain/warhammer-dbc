import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookDocuments, linkIndexFrom, readPackDocs, stableId } from "../../tools/book-docs.mjs";

// Подставные паки-библиотеки: два предмета, актор и папка. Папка в индекс
// попадать не должна — ссылка на неё не ведёт никуда.
let root;
const packs = () => [
  { name: "weapons", type: "Item",  dir: join(root, "weapons") },
  { name: "gear",    type: "Item",  dir: join(root, "gear") },
  { name: "bestiary", type: "Actor", dir: join(root, "bestiary") }
];

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "dbc-book-docs-"));
  const doc = (dir, file, data) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, file), JSON.stringify(data), "utf8");
  };
  doc("weapons", "_Folder.json", { name: "Болтерное", _id: "folder0000000001", type: "Item" });
  doc("weapons", "bolt.json",    { name: "Bolt Pistol / Болт-пистолет", _id: "aaaaaaaaaaaaaaa1" });
  doc("weapons/Болтерное_folder0000000001", "heavy.json",
      { name: "Heavy Bolter / Тяжёлый болтер", _id: "aaaaaaaaaaaaaaa2" });
  doc("gear",     "rope.json",   { name: "Bolt Pistol / Болт-пистолет", _id: "bbbbbbbbbbbbbbb1" });
  doc("gear",     "short.json",  { name: "Ай", _id: "bbbbbbbbbbbbbbb2" });
  doc("bestiary", "grot.json",   { name: "Гретчин", _id: "ccccccccccccccc1" });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("readPackDocs", () => {
  it("читает документы из вложенных папок и не считает папку документом", () => {
    const names = readPackDocs(join(root, "weapons")).map(d => d.name);
    expect(names).toHaveLength(2);
    expect(names).toContain("Bolt Pistol / Болт-пистолет");
    expect(names).toContain("Heavy Bolter / Тяжёлый болтер");
  });
});

describe("linkIndexFrom", () => {
  it("uuid собирается из имени пака, типа документа и его id", () => {
    expect(linkIndexFrom(packs()).get("Гретчин"))
      .toBe("Compendium.warhammer-dbc.bestiary.Actor.ccccccccccccccc1");
  });

  it("двуязычное название индексируется целиком и по половинам", () => {
    const index = linkIndexFrom(packs());
    const uuid = "Compendium.warhammer-dbc.weapons.Item.aaaaaaaaaaaaaaa1";
    expect(index.get("Bolt Pistol / Болт-пистолет")).toBe(uuid);
    expect(index.get("Bolt Pistol")).toBe(uuid);
    expect(index.get("Болт-пистолет")).toBe(uuid);
  });

  it("повтор названия остаётся за паком, объявленным раньше", () => {
    expect(linkIndexFrom(packs()).get("Болт-пистолет"))
      .toBe("Compendium.warhammer-dbc.weapons.Item.aaaaaaaaaaaaaaa1");
  });

  it("названия короче четырёх символов в индекс не идут", () => {
    expect(linkIndexFrom(packs()).has("Ай")).toBe(false);
  });
});

describe("stableId", () => {
  it("16 символов из алфавита идентификаторов Foundry", () => {
    expect(stableId("core", "entry", "0")).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it("одни и те же части дают один и тот же id", () => {
    expect(stableId("core", "entry", "0")).toBe(stableId("core", "entry", "0"));
  });

  it("разные части дают разные id", () => {
    expect(stableId("core", "entry", "0")).not.toBe(stableId("core", "entry", "1"));
  });
});

describe("bookDocuments", () => {
  const book = { slug: "core", pack: "book-core" };
  const data = {
    file: "DoomBC_Core.pdf",
    title: "Основная книга",
    entries: [{
      name: "АРСЕНАЛ",
      pdfPage: 12,
      pages: [
        { name: "Оружие", pdfPage: 12, html: "<p>Стреляет Болт-пистолет и всё.</p>" },
        { name: "Броня",  pdfPage: 14, html: "<p>Ничего знакомого.</p>" }
      ]
    }]
  };

  const docs = () => bookDocuments(book, data, linkIndexFrom(packs()));

  it("глава становится JournalEntry, раздел — страницей", () => {
    const [entry] = docs();
    expect(entry.name).toBe("АРСЕНАЛ");
    expect(entry.pages.map(p => p.name)).toEqual(["Оружие", "Броня"]);
  });

  it("ключи документа и страниц в формате компендиума", () => {
    const [entry] = docs();
    expect(entry._key).toBe(`!journal!${entry._id}`);
    expect(entry.pages[0]._key).toBe(`!journal.pages!${entry._id}.${entry.pages[0]._id}`);
  });

  it("порядок задаётся полем sort", () => {
    const [entry] = docs();
    expect(entry.sort).toBe(100);
    expect(entry.pages.map(p => p.sort)).toEqual([100, 200]);
  });

  it("книга и страница PDF сохраняются во флагах", () => {
    const [entry] = docs();
    expect(entry.flags["warhammer-dbc"]).toMatchObject({ book: "core", pdfPage: 12, source: "DoomBC_Core.pdf" });
    expect(entry.pages[1].flags["warhammer-dbc"]).toMatchObject({ book: "core", pdfPage: 14 });
  });

  it("знакомые названия в тексте становятся ссылками @UUID", () => {
    const [entry] = docs();
    expect(entry.pages[0].text.content)
      .toContain("@UUID[Compendium.warhammer-dbc.weapons.Item.aaaaaaaaaaaaaaa1]{Болт-пистолет}");
    expect(entry.pages[1].text.content).toBe("<p>Ничего знакомого.</p>");
  });

  it("повторная сборка даёт те же идентификаторы", () => {
    expect(docs()[0]._id).toBe(docs()[0]._id);
  });
});
