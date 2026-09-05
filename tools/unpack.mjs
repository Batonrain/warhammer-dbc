// tools/unpack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Извлекает компендиумы из LevelDB в исходники: npm run packs:unpack.
//  Обратная операция — npm run packs:build.
//
//  Библиотеки: packs-src/<имя пака>/ — по файлу на документ, как их пишет
//  инструмент Foundry.
//  Книги: packs-src/books/<slug>.json — по файлу на книгу, формат прежний,
//  его же читает импорт книг в живом мире (module/apps/books.mjs).
//
//  extractPack идёт с clean:true — папка исходника пака перезаписывается
//  целиком содержимым базы. Любая правка packs-src, которую не успели
//  закоммитить (а тем более — которую вообще не открывали в git add),
//  исчезла бы молча и без возможности восстановления. Поэтому перед
//  извлечением — сторож: незакоммиченные пути под packs-src останавливают
//  команду, пока их не сохранят или не подтвердят потерю флагом --force
//  (wdbc-bncx: словесное предупреждение в dbc-workflow уже не сработало
//  один раз, и требовать от каждого вызова помнить об этом руками — не план).
//
//  --pack=имя1,имя2 — снять только перечисленные паки (имена как в
//  system.json), не все LIBRARY_PACKS/JOURNAL_PACKS разом. Сторож дирти тоже
//  сужается до исходников этих паков: дрейф в одном паке больше не требует
//  вслепую трогать остальные и не может стереть чужой WIP в них (wdbc-3i9g,
//  инцидент 2026-09-03 — unpack без --pack затёр незакоммиченные правки в
//  packs-src/weapons, хотя дрейф был только в vehicles/bestiary/книгах).
// ════════════════════════════════════════════════════════════════════════

import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NAME_LIMIT, safe } from "./pack-file-name.mjs";
import { JOURNAL_PACKS, LIBRARY_PACKS, ROOT, SRC_ROOT, abs, isPacksBusy, reportBusy } from "./packs.mjs";
import { bookSource } from "./book-source.mjs";
import { writeStamp } from "./pack-stamp.mjs";
import { allFingerprints } from "./pack-fingerprint.mjs";
import { uncommittedPacksSrc } from "./git-status.mjs";
import { docIdsIn, docsMissingInDb } from "./pack-drift.mjs";

// ── --pack=имя1,имя2: сузить набор паков ──
const packArg = process.argv.find((a) => a.startsWith("--pack="));
const packFilter = packArg ? packArg.slice("--pack=".length).split(",").map((s) => s.trim()).filter(Boolean) : null;

const libraryPacks = packFilter ? LIBRARY_PACKS.filter((p) => packFilter.includes(p.name)) : LIBRARY_PACKS;
const journalPacks = packFilter ? JOURNAL_PACKS.filter((p) => packFilter.includes(p.name)) : JOURNAL_PACKS;

if (packFilter) {
  const known = new Set([...LIBRARY_PACKS, ...JOURNAL_PACKS].map((p) => p.name));
  const unknown = packFilter.filter((name) => !known.has(name));
  if (unknown.length) {
    console.error(`Неизвестные паки в --pack: ${unknown.join(", ")}`);
    console.error("Имена — как в system.json (поле packs[].name).");
    process.exit(1);
  }
}

// ── Сторож несохранённых правок packs-src ──
const FORCE = process.argv.includes("--force");
const guardRoots = packFilter
  ? [...libraryPacks.map((p) => p.src), ...journalPacks.map((b) => `${SRC_ROOT}/books/${b.slug}.json`)]
  : [SRC_ROOT];
const dirty = uncommittedPacksSrc(guardRoots);

if (dirty.length && !FORCE) {
  console.error(`В ${guardRoots.join(", ")} есть незакоммиченные правки — unpack перезапишет их содержимым живого компендиума:`);
  for (const path of dirty) console.error(`  ${path}`);
  console.error("");
  console.error("Сохраните их первым делом: git add -- packs-src && git commit");
  console.error("Если эти правки не нужны — снимите поверх них: npm run packs:unpack -- --force");
  process.exit(1);
}

// ── Имена файлов исходника ────────────────────────────────────────────────
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

// Сторож ОБРАТНОГО рассинхрона: исходники новее базы (wdbc-uozs).
//
// Извлечение идёт с clean:true — папка исходника перезаписывается составом
// базы целиком, поэтому документ, которого в базе НЕТ, из packs-src молча
// исчезает. Раньше это проверялось только в одну сторону (сборка не сносит
// ручные правки), и обратный случай стоил 45 удалённых файлов: ветка
// психосил «Мировой Певец» лежала в исходниках и отсутствовала в собранном
// компендиуме.
//
// Поэтому извлекаем СНАЧАЛА во временный каталог, сравниваем состав по
// идентификаторам документов и только потом переносим на место.
const libTmp = mkdtempSync(join(tmpdir(), "dbc-unpack-lib-"));
const behind = [];

let done = 0;
try {
  for (const p of libraryPacks) {
    if (!hasDb(p)) continue;
    const stage = join(libTmp, p.name);
    // Временный каталог наполняется КОПИЕЙ текущего исходника, и это не
    // оптимизация, а условие правильности: `omitVolatile` не переписывает
    // файл, только если ему есть с чем сравнить. Извлечение в пустой каталог
    // сравнивать не с чем, поэтому каждый файл пишется заново — и порядок
    // ключей в JSON может разойтись с тем, что лежит в репозитории. Ровно так
    // и вышло: круговорот компендиумов на CI покраснел на одном документе,
    // у которого поле `_key` переехало в конец объекта, хотя данные те же.
    if (existsSync(abs(p.src))) cpSync(abs(p.src), stage, { recursive: true });
    // clean снимает файлы удалённых документов, omitVolatile не переписывает
    // файл, если изменились только метки времени в _stats.
    try {
      await extractPack(abs(p.dir), stage, {
        folders: true, clean: true, omitVolatile: true, transformFolderName, transformName
      });
    } catch (e) {
      // Запущенная Foundry держит базы открытыми — из стека ядра это не следует.
      if (isPacksBusy(e)) { reportBusy(e, "снять"); process.exit(1); }
      throw e;
    }

    const srcIds = docIdsIn(abs(p.src));
    const lost = docsMissingInDb(srcIds.keys(), docIdsIn(stage).keys());
    if (lost.length && !FORCE) {
      behind.push({ pack: p.name, files: lost.map(id => srcIds.get(id)) });
      continue;
    }

    rmSync(abs(p.src), { recursive: true, force: true });
    cpSync(stage, abs(p.src), { recursive: true });
    console.log(`извлечён ${p.name} → ${p.src}`);
    done++;
  }
} finally {
  rmSync(libTmp, { recursive: true, force: true });
}

if (behind.length) {
  console.error("База ОТСТАЁТ от исходников — извлечение стёрло бы то, чего в ней нет:");
  for (const { pack, files } of behind) {
    console.error(`  ${pack}: ${files.length} докум. только в packs-src`);
    for (const file of files.slice(0, 5)) console.error(`    ${file.replace(ROOT, "")}`);
    if (files.length > 5) console.error(`    …и ещё ${files.length - 5}`);
  }
  console.error("");
  console.error("Похоже, packs-src правили и не собирали. Соберите базу: npm run packs:build");
  console.error("Если эти документы не нужны — снимите поверх них: npm run packs:unpack -- --force");
  process.exit(1);
}

// Книги извлекаются во временную папку по документу на файл, а в исходник
// пишутся одним файлом на книгу: так их читает импорт в мире.
const tmp = mkdtempSync(join(tmpdir(), "dbc-unpack-"));
try {
  for (const b of journalPacks) {
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

// Правки сняты в исходники — базы и packs-src снова сведены. Сборка сверяется
// с этой отметкой и без неё считала бы ручные правки несохранёнными вечно.
// Отметка одна на весь packs-src (не по паку) — при --pack сдвигать её нельзя:
// это скрыло бы от следующей ПОЛНОЙ сборки уже существующий, не тронутый
// сейчас дрейф в паках вне фильтра. Цена — следующий packs:build может
// потребовать --force именно для только что снятых паков (их база не старше
// новой отметки не станет), это не опасно: --force там примет ровно то, что
// мы только что записали в исходники.
if (packFilter) {
  console.log("--pack задан: отметка синхронизации не сдвинута (сдвигает только полный запуск).");
} else {
  await writeStamp(Date.now(), await allFingerprints([...libraryPacks, ...journalPacks], abs));
}

console.log(`Готово: ${done} из ${libraryPacks.length + journalPacks.length}.`);
console.log("Правки в исходниках — их можно коммитить: git add packs-src");
