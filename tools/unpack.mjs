// tools/unpack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Извлекает компендиумы из LevelDB в исходники: npm run packs:unpack.
//  Обратная операция — npm run packs:build.
//
//  Библиотеки: packs-src/<имя пака>/ — по файлу на документ, как их пишет
//  инструмент Foundry.
//  Книги: packs-src/books/<slug>.json — по файлу на книгу, формат прежний,
//  его же читает импорт книг в живом мире (module/apps/books.mjs).
// ════════════════════════════════════════════════════════════════════════

import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JOURNAL_PACKS, LIBRARY_PACKS, SRC_ROOT, abs } from "./packs.mjs";
import { bookSource } from "./book-source.mjs";

const hasDb = (p) => {
  if (existsSync(abs(p.dir, "CURRENT"))) return true;
  console.warn(`пропущен ${p.name}: в ${p.dir} нет базы LevelDB`);
  return false;
};

let done = 0;
for (const p of LIBRARY_PACKS) {
  if (!hasDb(p)) continue;
  // clean снимает файлы удалённых документов, omitVolatile не переписывает
  // файл, если изменились только метки времени в _stats.
  await extractPack(abs(p.dir), abs(p.src), { folders: true, clean: true, omitVolatile: true });
  console.log(`извлечён ${p.name} → ${p.src}`);
  done++;
}

// Книги извлекаются во временную папку по документу на файл, а в исходник
// пишутся одним файлом на книгу: так их читает импорт в мире.
const tmp = mkdtempSync(join(tmpdir(), "dbc-unpack-"));
try {
  for (const b of JOURNAL_PACKS) {
    if (!hasDb(b)) continue;
    const stage = join(tmp, b.name);
    await extractPack(abs(b.dir), stage, {});
    const docs = readdirSync(stage)
      .filter(f => f.endsWith(".json"))
      .map(f => JSON.parse(readFileSync(join(stage, f), "utf8")));
    const file = abs(`${SRC_ROOT}/books/${b.slug}.json`);
    const source = bookSource(JSON.parse(readFileSync(file, "utf8")), docs);
    writeFileSync(file, JSON.stringify(source, null, 1), "utf8");
    const pages = source.entries.reduce((n, e) => n + e.pages.length, 0);
    console.log(`извлечена книга ${b.slug}: глав — ${source.entries.length}, разделов — ${pages}`);
    done++;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Готово: ${done} из ${LIBRARY_PACKS.length + JOURNAL_PACKS.length}.`);
