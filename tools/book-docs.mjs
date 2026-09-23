// tools/book-docs.mjs
// ════════════════════════════════════════════════════════════════════════
//  Документы книжных компендиумов из packs-src/books/*.json.
//
//  То же, что делает fillBookPacks в живом мире (module/apps/books.mjs):
//  глава -> JournalEntry, раздел -> JournalEntryPage, знакомые названия ->
//  ссылки @UUID. Отличия два, и оба вынужденные:
//
//    1. индекс ссылок собирается не из game.packs, а из JSON извлечённых
//       паков — id документов там те же, поэтому ссылки указывают туда же;
//    2. идентификаторы глав и страниц не случайные, а выведенные из книги и
//       номера главы: пересборка не должна менять ссылки на страницы книг.
//
//  Общий с миром код — indexNames и linkify, они импортируются, а не
//  повторяются: разойдясь, они дали бы разные книги в CI и в мире.
// ════════════════════════════════════════════════════════════════════════

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { indexNames, linkify, outlineFlags } from "../module/apps/books.mjs";

/** Алфавит идентификаторов Foundry. */
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 16;

/**
 * Документы пака из JSON: имя и id, больше для индекса ссылок не нужно.
 * Папки (_Folder.json) документами не считаются.
 */
export function readPackDocs(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith(".json") || e.name === "_Folder.json") continue;
      const doc = JSON.parse(readFileSync(p, "utf8"));
      if (doc.name && doc._id) out.push({ name: doc.name, _id: doc._id });
    }
  };
  walk(dir);
  return out;
}

/**
 * Индекс ссылок по JSON-исходникам паков-библиотек.
 * Паки перебираются в порядке объявления в system.json — как game.packs в
 * живом мире, иначе повтор названия достался бы другому паку.
 */
export function linkIndexFrom(packs) {
  const entries = [];
  for (const p of packs) {
    for (const doc of readPackDocs(p.dir)) {
      entries.push({ name: doc.name, uuid: `Compendium.warhammer-dbc.${p.name}.${p.type}.${doc._id}` });
    }
  }
  return indexNames(entries);
}

/**
 * Идентификатор, выведенный из частей: те же части — тот же id.
 *
 * Разделитель — литерал NUL (0x00), не пробел: в редакторе выглядит как
 * обычный пробел, поэтому легко "поправить" случайно (нормализация пробелов,
 * copy-paste). Трогать нельзя: живые _id глав и страниц уже собранных
 * книжных паков (packs-src/books/*.json → packs/book-*, tools/pack.mjs)
 * вычислены ИМЕННО с этим байтом — смена разделителя на что угодно другое
 * поменяет их ВСЕ при следующей npm run packs:build и осиротит любые ссылки
 * на страницы книг, сохранённые в живых мирах (закладки, заметки на сценах).
 * С wdbc-bjy1.10 этот id вычисляется только для ещё не проштампованных
 * глав/разделов: остальные несут свой _id в исходнике (tools/book-stamp-ids.mjs).
 * Проверено по факту: stableId(...) с этим байтом воспроизводит реальные
 * _id из packs/book-core бит-в-бит (bd wdbc-gap5). Байт защищён от случайной
 * порчи явным escape-литералом `\x00` ниже — не переписывать на `" "`.
 */
export function stableId(...parts) {
  const digest = createHash("sha256").update(parts.join("\x00")).digest();
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[digest[i] % ID_ALPHABET.length];
  return id;
}


/**
 * Главы книги как документы компендиума.
 * @param {{slug: string}} book   запись книги из BOOK_PACKS
 * @param {object} data           содержимое packs-src/books/<slug>.json
 * @param {Map<string,string>} index  индекс ссылок
 */
export function bookDocuments(book, data, index) {
  return data.entries.map((chapter, i) => {
    // Замороженный _id из исходника (wdbc-bjy1.10) — вычисленный по позиции
    // только для ещё не проштампованных (node tools/book-stamp-ids.mjs): иначе
    // вставка раздела в середину главы сдвигала id всех следующих.
    const entryId = chapter._id || stableId(book.slug, "entry", String(i), chapter.name);
    return {
      _id: entryId,
      _key: `!journal!${entryId}`,
      name: chapter.name,
      folder: null,
      sort: (i + 1) * 100,
      ownership: { default: 0 },
      flags: { "warhammer-dbc": { book: book.slug, pdfPage: chapter.pdfPage, source: data.file } },
      pages: chapter.pages.map((page, j) => {
        const pageId = page._id || stableId(book.slug, "page", String(i), String(j), page.name);
        return {
          _id: pageId,
          _key: `!journal.pages!${entryId}.${pageId}`,
          name: page.name,
          type: "text",
          title: { show: true, level: page.level || 1 },   // уровень раздела в закладках PDF
          sort: (j + 1) * 100,
          text: { format: 1, content: linkify(page.html, index) },
          ownership: { default: -1 },
          flags: { "warhammer-dbc": { book: book.slug, pdfPage: page.pdfPage, ...outlineFlags(page) } }
        };
      })
    };
  });
}

/**
 * Идентификаторы, которые породил бы bookDocuments из данного исходника:
 * глава -> id, раздел -> id. Индекс ссылок не нужен — на id он не влияет,
 * только на текст (linkify).
 *
 * Нужна, чтобы сравнить состав ИСХОДНИКА с составом БАЗЫ тем же способом,
 * что и для паков-библиотек (tools/pack-drift.mjs): документ, которого нет в
 * базе, молча пропал бы при извлечении, потому что unpack строит книгу
 * ЦЕЛИКОМ из того, что нашлось в LevelDB (tools/book-source.mjs, bookSource).
 *
 * @param {{slug: string}} book  запись книги из BOOK_PACKS
 * @param {object} data          содержимое packs-src/books/<slug>.json
 * @returns {Map<string,string>} идентификатор -> человекочитаемое имя, для отчёта
 */
export function bookDocIds(book, data) {
  const out = new Map();
  for (const doc of bookDocuments(book, data, new Map())) {
    out.set(doc._id, doc.name);
    for (const page of doc.pages) out.set(page._id, `${doc.name} → ${page.name}`);
  }
  return out;
}
