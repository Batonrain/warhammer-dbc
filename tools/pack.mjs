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
//  и не снятые через npm run packs:unpack, сборка потеряла бы — поэтому перед
//  работой она сверяется с отметкой последней синхронизации (pack-stamp.mjs) и
//  останавливается, если в игре правили позже. Пересобрать поверх правок можно
//  флагом --force: он говорит «эти правки мне не нужны».
// ════════════════════════════════════════════════════════════════════════

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JOURNAL_PACKS, LIBRARY_PACKS, SRC_ROOT, abs, isPacksBusy, reportBusy } from "./packs.mjs";
import { latestDbChange, packsChangedSince, readStamp, writeStamp } from "./pack-stamp.mjs";
import { packFingerprintInfo, allFingerprints, FINGERPRINT_VERSION } from "./pack-fingerprint.mjs";
import { bookDocuments, linkIndexFrom } from "./book-docs.mjs";

/**
 * Собирает пак заново, снося прежнюю базу. Возвращает число документов, которые
 * реально легли в базу: `transformEntry` зовётся на каждый документ, и это
 * единственный честный счётчик — сам `compilePack` ничего не возвращает.
 */
async function build(src, dir) {
  try {
    rmSync(abs(dir), { recursive: true, force: true });
    mkdirSync(abs(dir), { recursive: true });
    let docs = 0;
    await compilePack(src, abs(dir), { recursive: true, transformEntry: () => { docs++; } });
    return docs;
  } catch (e) {
    // Запущенная Foundry держит базы открытыми — из стека ядра это не следует.
    if (isPacksBusy(e)) { reportBusy(e, "собрать"); process.exit(1); }
    throw e;
  }
}

// ── Сторож ручных правок ──
// Сборка сносит базу пака целиком, поэтому всё, что правили в игре и не сняли в
// исходники, она потеряла бы молча. Отметку ставят обе команды — сборка и
// извлечение (tools/pack-stamp.mjs); база новее отметки означает, что в Foundry
// правили после последней синхронизации.
//
// Решает не дата файлов, а ОТПЕЧАТОК СОДЕРЖИМОГО (wdbc-1c10): classic-level
// переписывает .ldb при открытии базы, не меняя ни одного документа, и по одной
// дате «мир открывали» неотличимо от «в мире правили». Дата осталась быстрым
// предфильтром — отпечаток считается только у паков, которые её не прошли, и
// только они открываются на чтение.
const FORCE = process.argv.includes("--force");
const stamp = readStamp();
const stampWhen = typeof stamp === "number" ? stamp : stamp?.when;
const suspects = [...LIBRARY_PACKS, ...JOURNAL_PACKS]
  .map(p => ({ pack: p, mtimeMs: latestDbChange(p.dir) }))
  .filter(x => !stampWhen || x.mtimeMs > stampWhen + 1000);
const probed = await Promise.all(suspects.map(async x => ({
  name: x.pack.name, mtimeMs: x.mtimeMs, ...await packFingerprintInfo(abs(x.pack.dir))
})));

// Занятая база — не правка (wdbc-7qjg). Мир держит LOCK на каждом открытом
// паке, отпечаток становится нечитаем, и сторож объявлял «в компендиумах есть
// правки» с советом сделать unpack, который на занятой базе тоже не работает.
// Диагноз ложный, совет невыполнимый: сказать надо ровно то, что есть — мир
// запущен, закройте его. Сборка всё равно дальше не пройдёт (rmSync по
// занятой папке), просто теперь она объясняет это правильно.
const busy = probed.filter(p => p.busy).map(p => p.name);
if (busy.length) {
  console.error("Мир запущен — базы компендиумов заняты, прочитать их нечем:");
  console.error(`  ${busy.join(", ")}`);
  console.error("");
  console.error("Это не значит, что в игре что-то правили. Закройте мир в Foundry");
  console.error("(«Return to Setup») и повторите сборку.");
  process.exit(1);
}

// Отметка посчитана ДРУГОЙ версией алгоритма отпечатка (wdbc-7qjg) — значит
// сравнивать буквально не с чем: цифры разойдутся у всех паков сразу, и ни
// один из них при этом никто не правил. Останавливаемся (судить о содержимом
// нечем — ошибаемся в безопасную сторону), но говорим правду, а не «в
// компендиумах есть правки»: прежний текст отправлял снимать несуществующие
// правки через unpack.
const stampVersion = typeof stamp === "number" ? 1 : (stamp?.fpVersion ?? 1);
if (stamp && stampVersion !== FINGERPRINT_VERSION && !FORCE) {
  console.error(`Отметка синхронизации посчитана другой версией отпечатка `
    + `(в отметке ${stampVersion}, сейчас ${FINGERPRINT_VERSION}) — сравнивать не с чем.`);
  console.error("");
  console.error("Это НЕ значит, что в игре что-то правили. Если правок не было —");
  console.error("пересоберите поверх, отметка обновится: npm run packs:build -- --force");
  console.error("Если правки были — сперва снимите их: npm run packs:unpack");
  process.exit(1);
}

const edited = packsChangedSince(stamp, probed);

if (edited.length && !FORCE) {
  console.error("В компендиумах есть правки, которых нет в исходниках:");
  console.error(`  ${edited.join(", ")}`);
  console.error("");
  console.error("Сборка снесла бы их вместе с базой. Снимите правки в исходники:");
  console.error("  npm run packs:unpack");
  console.error("Если правки не нужны — пересоберите поверх: npm run packs:build -- --force");
  process.exit(1);
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

// Базы и исходники сведены — отметка сдвигается, иначе следующая же сборка
// приняла бы собственную запись за чужую правку.
await writeStamp(Date.now(), await allFingerprints([...LIBRARY_PACKS, ...JOURNAL_PACKS], abs));

console.log(`Готово: ${LIBRARY_PACKS.length} библиотек, ${JOURNAL_PACKS.length} книг.`);
