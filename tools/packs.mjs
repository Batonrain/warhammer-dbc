// tools/packs.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общая часть инструментов сборки компендиумов.
//
//  Источник истины о паках — system.json: там объявленные имена, пути и типы.
//  Читать содержимое папки packs/ нельзя: в ней лежат директории, которых в
//  system.json нет (packs/effects, packs/script-library, packs/book-homeworlds),
//  Foundry их не загружает, и попадать в сборку они не должны.
//
//  Паки делятся на два вида, и собираются они по-разному:
//
//    библиотеки (Item, Actor) — JSON извлекается из LevelDB (tools/unpack.mjs)
//                               и лежит в packs-src/<имя пака>/;
//    книги (JournalEntry)     — собираются из packs-src/books/<slug>.json,
//                               извлекать их не нужно: исходник уже есть.
// ════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BOOK_PACKS } from "../module/apps/books.mjs";

/** Корень репозитория: инструменты не зависят от текущей папки вызова. */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Путь от корня репозитория. */
export const abs = (...parts) => ROOT + parts.join("/");

export const SRC_ROOT = "packs-src";

const system = JSON.parse(readFileSync(abs("system.json"), "utf8"));
const bookPacks = new Set(BOOK_PACKS.map(b => b.pack));

/**
 * Объявленные паки.
 * name — идентификатор внутри системы, dir — папка LevelDB (может не
 * совпадать с именем: пак book-homeworlds лежит в packs/book-origins),
 * src — папка JSON-исходников.
 */
export const PACKS = system.packs.map(p => ({
  name: p.name,
  type: p.type,
  dir:  p.path,
  src:  `${SRC_ROOT}/${p.name}`
}));

/** Паки-библиотеки: предметы и акторы. */
export const LIBRARY_PACKS = PACKS.filter(p => !bookPacks.has(p.name));

/** Паки-книги в порядке объявления, с данными для сборки из JSON. */
export const JOURNAL_PACKS = BOOK_PACKS.map(b => ({
  ...b,
  ...PACKS.find(p => p.name === b.pack)
}));
