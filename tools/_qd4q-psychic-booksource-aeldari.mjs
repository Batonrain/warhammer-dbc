// tools/_qd4q-psychic-booksource-aeldari.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разовый скрипт для wdbc-qd4q: заполняет system.bookSource у
//  packs-src/psychic-powers/АЭЛЬДАРИ/** (264 записи, 7 под-папок дисциплин).
//
//  ВАЖНОЕ ОТЛИЧИЕ от _qd4q-psychic-booksource-core.mjs: aeldari.json и
//  aeldari-branches.json собраны конвейером html-book-import.py из
//  HTML-экспорта Google Docs, а НЕ из PDF со сканом (проверено: 0 меток
//  <section data-pdf-page> в обоих файлах, при 47 в core.json). Поле
//  page.pdfPage в этих книгах — сквозной ПОРЯДКОВЫЙ номер "страницы" JSON
//  (1, 2, 3, 14.1, 14.2 …), не номер страницы настоящего PDF — использовать
//  его в цитате означало бы написать ПРАВДОПОДОБНУЮ, но ФИКТИВНУЮ ссылку
//  (см. dbc-content skill, инцидент wdbc-kf5k). Настоящих номеров страниц
//  для этих книг в packs-src просто нет.
//
//  Поэтому цитата строится БЕЗ номера страницы: книга + глава (страница
//  документа, дословно совпадающая с именем папки — "ДИСЦИПЛИНА ВАРЛОКА" и
//  т.п.) + подраздел (system.subtype — сверен и совпадает с ветками
//  дисциплины в PSY_DISCIPLINES, module/constants/disciplines.mjs), с явной
//  припиской, что номер страницы не проставлен и почему. Это тот же
//  паттерн "непроверяемая цитата", что и у части архетипов Аэльдари
//  (wdbc-teyu) — только там неизвестно даже само наличие текста в книге, а
//  здесь текст найден (см. отчёт wdbc-qd4q), неизвестен только номер
//  страницы PDF.
//
//    node tools/_qd4q-psychic-booksource-aeldari.mjs --dry
//    node tools/_qd4q-psychic-booksource-aeldari.mjs
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PP = path.join(ROOT, "packs-src", "psychic-powers", "АЭЛЬДАРИ");

// Номер страницы намеренно не указывается в самом поле (поле читает игрок в
// справочнике психосил) — см. комментарий в шапке файла и отчёт wdbc-qd4q,
// почему для Книги Аэльдари/Ответвлений это честная граница, а не недосмотр.

// Папка -> { книга, глава (= дословное имя страницы в книге) }
const FOLDER_MAP = {
  "ВАРЛОКА": { book: "Книга Аэльдари", chapter: "ДИСЦИПЛИНА ВАРЛОКА" },
  "ПРОВИДЕЦ": { book: "Книга Аэльдари", chapter: "ДИСЦИПЛИНА ПРОВИДЦА" },
  "ПРОВИДЕЦ_ДУХОВ": { book: "Книга Аэльдари", chapter: "ДИСЦИПЛИНА ПРОВИДЦА ДУХОВ" },
  "ПУСТОТНЫЙ_МЕЧТАТЕЛЬ": { book: "Книга Аэльдари", chapter: "ДИСЦИПЛИНА ПУСТОТНОГО МЕЧТАТЕЛЯ" },
  "РУНЫ_СУДЬБЫ_И_БИТВЫ": { book: "Книга Аэльдари", chapter: "РУНЫ СУДЬБЫ И БИТВЫ" },
  "РЕВЕНАНТ": { book: "Книга Аэльдари: Ответвления", chapter: "ДИСЦИПЛИНА РЕВЕНАНТА" },
  "МИРОВОЙ_ПЕВЕЦ": { book: "Книга Аэльдари: Ответвления", chapter: "ДИСЦИПЛИНА МИРОВОГО ПЕВЦА" },
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

function run({ dry = false } = {}) {
  const report = {};

  for (const [folder, { book, chapter }] of Object.entries(FOLDER_MAP)) {
    const dir = path.join(PP, folder);
    const files = walk(dir);
    let changed = 0, alreadySet = 0, noSubtype = 0;
    const noSubtypeFiles = [];

    for (const abs of files) {
      const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
      const subtype = doc.system.subtype;
      if (!subtype) {
        noSubtype++;
        noSubtypeFiles.push(path.relative(dir, abs).split(path.sep).join("/"));
        continue;
      }

      const value = `${book}, ${chapter} («${subtype}»)`;

      if (doc.system.bookSource === value) { alreadySet++; continue; }
      doc.system.bookSource = value;
      if (!dry) fs.writeFileSync(abs, JSON.stringify(doc, null, 2) + "\n", "utf8");
      changed++;
    }

    report[folder] = { total: files.length, changed, alreadySet, noSubtype, noSubtypeFiles };
  }

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes("--dry");
  const report = run({ dry });
  for (const [folder, r] of Object.entries(report)) {
    console.log(`\n=== ${folder}: всего ${r.total}, изменено ${r.changed}${dry ? " (dry-run)" : ""}, уже совпадало ${r.alreadySet}, без subtype ${r.noSubtype}`);
    if (r.noSubtypeFiles.length) console.log("  без subtype:", r.noSubtypeFiles.join(", "));
  }
}

export { run };
