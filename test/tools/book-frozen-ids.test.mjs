// test/tools/book-frozen-ids.test.mjs
//
// Сторож wdbc-bjy1.10: у каждой главы и раздела packs-src/books есть свой
// _id — иначе новый раздел получил бы id по позиции, и следующая вставка
// перед ним снова его сдвинула. Новые разделы штампуются одной командой:
//   node tools/book-stamp-ids.mjs

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { abs, SRC_ROOT } from "../../tools/packs.mjs";

const BOOKS_DIR = abs(`${SRC_ROOT}/books`);
const slugs = readdirSync(BOOKS_DIR).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));

describe("у глав и разделов книг замороженные _id", () => {
  it.each(slugs)("%s: у каждой главы и раздела есть уникальный 16-символьный _id", (slug) => {
    const data = JSON.parse(readFileSync(join(BOOKS_DIR, `${slug}.json`), "utf8"));
    const missing = [];
    const seen = new Set();
    const dups = [];
    for (const ch of data.entries ?? []) {
      if (!/^[A-Za-z0-9]{16}$/.test(ch._id ?? "")) missing.push(ch.name);
      for (const p of ch.pages ?? []) {
        if (!/^[A-Za-z0-9]{16}$/.test(p._id ?? "")) missing.push(`${ch.name} → ${p.name}`);
        else if (seen.has(p._id)) dups.push(p._id);
        else seen.add(p._id);
      }
    }
    expect(missing, "нет _id — запустите node tools/book-stamp-ids.mjs").toEqual([]);
    expect(dups, "повтор _id раздела в одной книге").toEqual([]);
  });
});
