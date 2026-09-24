// tools/book-stamp-ids.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Штамп _id глав и разделов книг (wdbc-bjy1.10).
//
//  Раньше _id вычислялся при сборке из ПОРЯДКОВОГО номера и имени (stableId в
//  tools/book-docs.mjs), и вставка раздела в середину главы сдвигала id всех
//  следующих — ссылки миров на них сиротели (в v0.1.227 так ушли 86 разделов
//  Книги Пустоты). Теперь id хранится в исходнике, и сборка берёт его оттуда.
//
//  Скрипт проставляет _id тем главам и разделам, у которых его ещё нет, —
//  ровно тот, что сборка выдала бы им СЕЙЧАС, поэтому у уже собранных паков
//  ничего не меняется. Уже проставленные не трогает. Запускать после
//  добавления разделов в книгу (сторож: test/tools/book-frozen-ids.test.mjs):
//
//    node tools/book-stamp-ids.mjs            — все книги
//    node tools/book-stamp-ids.mjs void core  — только перечисленные
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { bookDocuments } from "./book-docs.mjs";
import { abs, SRC_ROOT } from "./packs.mjs";

const BOOKS_DIR = abs(`${SRC_ROOT}/books`);
const only = process.argv.slice(2);
const slugs = readdirSync(BOOKS_DIR).filter(f => f.endsWith(".json"))
  .map(f => f.replace(/\.json$/, ""))
  .filter(s => !only.length || only.includes(s));

/** Тот же объект с _id первым ключом — остальной порядок ключей сохраняется. */
const withId = (obj, id) => (obj._id ? obj : { _id: id, ...obj });

let total = 0;
for (const slug of slugs) {
  const file = join(BOOKS_DIR, `${slug}.json`);
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  // Формат исходников книг — отступ в один пробел и перевод строки в конце.
  if (JSON.stringify(data, null, 1) + "\n" !== raw) {
    console.error(`${slug}: формат файла не канонический — пропущен, проверьте руками`);
    process.exitCode = 1;
    continue;
  }
  const docs = bookDocuments({ slug }, data, new Map());
  let stamped = 0;
  data.entries = data.entries.map((chapter, i) => {
    const doc = docs[i];
    if (!chapter._id) stamped++;
    const pages = chapter.pages.map((page, j) => {
      if (!page._id) stamped++;
      return withId(page, doc.pages[j]._id);
    });
    return { ...withId(chapter, doc._id), pages };
  });
  if (!stamped) continue;
  writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
  total += stamped;
  console.log(`${slug}: проставлено ${stamped}`);
}
console.log(`Всего проставлено _id: ${total}`);
