// tools/bestiary-book-source.mjs
// ════════════════════════════════════════════════════════════════════════
//  КНИГА-ИСТОЧНИК СУЩЕСТВ БЕСТИАРИЯ (wdbc-7pjs).
//
//  У акторов поля bookSource не было вовсе — открыв демона, ГМ не мог узнать,
//  из какой он книги. Поле заведено (module/data/actor/_creature.mjs), здесь
//  механическая часть заполнения: имя существа ищется в текстах книг, и если
//  нашлось РОВНО В ОДНОЙ — эта книга и записывается.
//
//  Правило то же, что у wdbc-eu1d для оружия: не нашлось однозначно —
//  оставить пустым, не угадывать. Страницу инструмент не проставляет: в
//  разобранных книгах номера страниц PDF не сохранены, а выдумывать их хуже,
//  чем не иметь.
//
//    node tools/bestiary-book-source.mjs --dry
//    node tools/bestiary-book-source.mjs
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json")) out.push(p);
  }
  return out;
}

const norm = (s) => String(s || "")
  .replace(/\u00ad/g, "").replace(/ё/gi, "е").toLowerCase().replace(/\s+/g, " ").trim();

/** slug книги → её человеческое название и весь текст. */
function books() {
  const out = [];
  for (const file of walk(path.join(ROOT, "packs-src/books"))) {
    let book;
    try { book = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    const text = (book.entries || []).flatMap(e => e.pages || [])
      .map(p => `${p.name}\n${String(p.html || "").replace(/<[^>]+>/g, " ")}`).join("\n");
    out.push({ slug: path.basename(file, ".json"), title: book.name || book.title || path.basename(file, ".json"),
               text: norm(text) });
  }
  return out;
}

export function run({ dry = false } = {}) {
  const libs = books();
  const found = [], ambiguous = [], missing = [];
  for (const file of walk(path.join(ROOT, "packs-src/bestiary"))) {
    if (file.endsWith("_Folder.json")) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (!doc?.name || !doc?.system) continue;
    const row = { name: doc.name, file: path.relative(ROOT, file).split(path.sep).join("/") };
    if (String(doc.system.bookSource || "").trim()) continue;
    const key = norm(String(doc.name).split("/").pop());
    if (key.length < 4) { missing.push(row); continue; }
    const hits = libs.filter(b => b.text.includes(key));
    if (hits.length === 1) {
      doc.system.bookSource = hits[0].title;
      if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
      found.push({ ...row, book: hits[0].title });
    } else if (hits.length > 1) ambiguous.push({ ...row, books: hits.map(h => h.title) });
    else missing.push(row);
  }
  return { found, ambiguous, missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { found, ambiguous, missing } = run({ dry: process.argv.includes("--dry") });
  for (const f of found.slice(0, 15)) console.log(`+ ${f.name}  →  ${f.book}`);
  console.log(`\nзаполнено однозначно: ${found.length} | в нескольких книгах: ${ambiguous.length}`
            + ` | не нашлось: ${missing.length}`);
}
