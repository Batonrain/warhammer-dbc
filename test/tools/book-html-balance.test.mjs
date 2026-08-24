// test/tools/book-html-balance.test.mjs
//
// Конвейеры книг (html-book-import.py, docx-book-import.py, merge-book-pages)
// склеивают страницы из кусков PDF/HTML — и уже теряли открывающий <section>
// или разрезали <p> границей секции (13 страниц в раунде 3 бэклога).
// Оборванный тег ProseMirror перестраивает непредсказуемо при первом же
// редактировании страницы. Контракт: на каждой странице каждой книги число
// открывающих и закрывающих <section> и <p> совпадает.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../tools/packs.mjs";

const BOOKS_DIR = join(ROOT, "packs-src/books");

describe("баланс HTML-тегов в страницах книг", () => {
  it("каждая страница закрывает столько же <section> и <p>, сколько открыла", () => {
    const bad = [];
    for (const file of readdirSync(BOOKS_DIR).filter(f => f.endsWith(".json"))) {
      const book = JSON.parse(readFileSync(join(BOOKS_DIR, file), "utf8"));
      (book.entries || []).forEach((entry, ei) => {
        (entry.pages || []).forEach((page, pi) => {
          const html = String(page.html || "");
          for (const tag of ["section", "p"]) {
            const open  = (html.match(new RegExp(`<${tag}\\b`, "g")) || []).length;
            const close = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
            if (open !== close)
              bad.push(`${file} entries[${ei}] pages[${pi}] «${page.name}»: <${tag}> ${open}/${close}`);
          }
        });
      });
    }
    expect(bad).toEqual([]);
  });
});
