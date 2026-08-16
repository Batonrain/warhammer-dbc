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

// ── Имена файлов исходника ────────────────────────────────────────────────
// Сам по себе CLI кладёт документ в «<Папка>_<id16>/<Название>_<id16>.json».
// На кириллице такой путь перестаёт влезать в лимит Windows: буква весит два
// байта, и самый длинный путь тянул на 300 байт при потолке в 260 — checkout
// падал с «Filename too long». Поэтому у каталогов снимается суффикс id
// (одноимённых соседей в паках нет), а название документа режется. Полное имя
// лежит внутри JSON, id в имени файла остаётся, максимум пути — 240 байт.
const NAME_LIMIT = 40;

/** Как в CLI: в имени файла остаются только буквы и цифры. */
const safe = (name) => String(name).replace(/[^a-zA-Z0-9А-я]/g, "_");

const transformFolderName = (doc) => (doc.name ? safe(doc.name) : doc._id);

const transformName = (doc, { documentType, folder }) => {
  // Папку именует transformFolderName, её «_Folder.json» собирает сам CLI.
  if (documentType === "Folder") return null;
  const stem = doc.name ? `${safe(doc.name).slice(0, NAME_LIMIT)}_${doc._id}` : doc._id;
  return folder ? join(folder, `${stem}.json`) : `${stem}.json`;
};

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
  await extractPack(abs(p.dir), abs(p.src), {
    folders: true, clean: true, omitVolatile: true, transformFolderName, transformName
  });
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
    // Перевод строки в конце — как у extractPack (CLI пишет `JSON.stringify(...) + "\n"`,
    // lib/package.mjs). Без него круговорот сборка → извлечение показывал правку в каждой
    // книге, а тест ниже сверяет исходники именно с тем, что пишут инструменты.
    writeFileSync(file, JSON.stringify(source, null, 1) + "\n", "utf8");
    const pages = source.entries.reduce((n, e) => n + e.pages.length, 0);
    console.log(`извлечена книга ${b.slug}: глав — ${source.entries.length}, разделов — ${pages}`);
    done++;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Готово: ${done} из ${LIBRARY_PACKS.length + JOURNAL_PACKS.length}.`);
