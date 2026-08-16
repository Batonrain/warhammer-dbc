// tools/pack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Собирает компендиумы из исходников: npm run packs:build.
//
//  Библиотеки — из packs-src/<имя>/ как есть. Книги — из packs-src/books/
//  через tools/book-docs.mjs: ссылки @UUID в их тексте нужно расставить, а для
//  этого нужны id предметов, поэтому книги собираются после библиотек.
//
//  Папка пака перед сборкой удаляется: иначе документы, удалённые из
//  исходника, остались бы в базе. Это значит, что правки, сделанные в Foundry
//  и не снятые через npm run packs:unpack, сборка потеряет.
// ════════════════════════════════════════════════════════════════════════

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JOURNAL_PACKS, LIBRARY_PACKS, SRC_ROOT, abs } from "./packs.mjs";
import { bookDocuments, linkIndexFrom } from "./book-docs.mjs";

/**
 * Собирает пак заново, снося прежнюю базу. Возвращает число документов, которые
 * реально легли в базу: `transformEntry` зовётся на каждый документ, и это
 * единственный честный счётчик — сам `compilePack` ничего не возвращает.
 */
async function build(src, dir) {
  rmSync(abs(dir), { recursive: true, force: true });
  mkdirSync(abs(dir), { recursive: true });
  let docs = 0;
  await compilePack(src, abs(dir), { recursive: true, transformEntry: () => { docs++; } });
  return docs;
}

for (const p of LIBRARY_PACKS) {
  if (!existsSync(abs(p.src))) {
    console.error(`нет исходника ${p.src} — пак ${p.name} остался бы пустым`);
    process.exit(1);
  }
  const docs = await build(abs(p.src), p.dir);
  // Пустой пак — всегда ошибка сборки, а не «так вышло»: объявленный в
  // system.json пак Foundry заводит сама, и пустая база выглядит в игре как
  // пустой компендиум, ничем не отличимый от забытого контента. Так пропали
  // «Расы»: сборка отчиталась «собран races» и промолчала про ноль документов.
  if (!docs) {
    console.error(`пак ${p.name} собрался пустым: в ${p.src} нет документов`);
    process.exit(1);
  }
  console.log(`собран ${p.name}: документов — ${docs}`);
}

const index = linkIndexFrom(LIBRARY_PACKS.map(p => ({ ...p, dir: abs(p.src) })));
console.log(`индекс ссылок: ${index.size} названий`);

const tmp = mkdtempSync(join(tmpdir(), "dbc-books-"));
try {
  for (const b of JOURNAL_PACKS) {
    const data = JSON.parse(readFileSync(abs(`${SRC_ROOT}/books/${b.slug}.json`), "utf8"));
    const docs = bookDocuments(b, data, index);
    const stage = join(tmp, b.name);
    mkdirSync(stage, { recursive: true });
    for (const doc of docs) writeFileSync(join(stage, `${doc._id}.json`), JSON.stringify(doc), "utf8");
    await build(stage, b.dir);
    const links = docs.reduce(
      (n, d) => n + d.pages.reduce((m, p) => m + (p.text.content.match(/@UUID\[/g) || []).length, 0), 0);
    console.log(`собран ${b.name}: глав — ${docs.length}, ссылок — ${links}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Готово: ${LIBRARY_PACKS.length} библиотек, ${JOURNAL_PACKS.length} книг.`);
