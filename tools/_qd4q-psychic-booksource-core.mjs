// tools/_qd4q-psychic-booksource-core.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разовый скрипт для wdbc-qd4q: заполняет system.bookSource у
//  packs-src/psychic-powers/{ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ,РЕДКИЕ_ДИСЦИПЛИНЫ,
//  БОЖЕСТВЕННЫЕ_ДИСЦИПЛИНЫ,ПСИХОСИЛЫ} — все четыре сверяются с
//  packs-src/books/core.json, глава «V. ПСАЙКАНА».
//
//  Метод: HTML книги размечен <section data-pdf-page="N"> с настоящими
//  номерами страниц PDF (core.json собран из PDF, не из Google Docs — есть
//  47 меток data-pdf-page). Внутри секций встречаются <h2>Название</h2>
//  заголовки (дисциплина ИЛИ подтип — оба уровня оформлены одинаковым тегом)
//  и <h4>English /Русское</h4> заголовки отдельных психосил с полным
//  текстом правила. Для каждой психосилы берём АНГЛИЙСКОЕ имя (часть до
//  "/" в system-имени файла), ищем точное совпадение с <h4>, достаём номер
//  страницы ближайшей охватывающей секции и текст ближайшего ПРЕДШЕСТВУЮЩЕГО
//  <h2> (это и есть дисциплина/подтип — в данных он же лежит в
//  system.subtype для Фундаментальных, совпадает с discipline label для
//  Психосил/Редких/Божественных, проверено на всех 444 записях, 0 расхождений).
//
//  Аэльдари сюда НЕ входят — там другой источник (aeldari*.json, HTML-экспорт
//  Google Docs без PDF-разметки страниц) и другой скрипт
//  (_qd4q-psychic-booksource-aeldari.mjs).
//
//    node tools/_qd4q-psychic-booksource-core.mjs --dry   # только план + отчёт о непокрытых
//    node tools/_qd4q-psychic-booksource-core.mjs         # применить
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BOOKS = path.join(ROOT, "packs-src", "books");
const PP = path.join(ROOT, "packs-src", "psychic-powers");

const BOOK_TITLE = "DoomBC — Основная книга";

// Дисциплины, у которых <h2> перед психосилой — это САМА дисциплина (h2 ==
// discipline label), а не подтип: подтипа в данных нет (subtype === "").
// Для Фундаментальных дисциплин <h2> — это подтип (system.subtype), и он
// комбинируется с русским названием дисциплины через тире.
const DISCIPLINE_LABELS = {
  // Психосилы (Регулярные)
  thaumaturgy: "Тауматургия", sorcery: "Колдовство", highSorcery: "Высшее Колдовство",
  daemonology: "Демонология",
  // Редкие
  chronomancy: "Хрономантия", cryomancy: "Криомантия", technomancy: "Техномантия",
  geomancy: "Геомантия", fulmination: "Фульминация", umbramancy: "Умбрамантия",
  librarium: "Либрариум", bloodMagic: "Магия крови",
  // Божественные
  slaanesh: "Слаанеш", nurgle: "Нургл", tzeentch: "Тзинч",
  // Фундаментальные
  telekinesis: "Телекинез", telepathy: "Телепатия", divination: "Прорицание",
  biomancy: "Биомантия", pyromancy: "Пиромантия",
};

const FUNDAMENTAL = new Set(["telekinesis", "telepathy", "divination", "biomancy", "pyromancy"]);

function normName(s) {
  return String(s ?? "")
    .replace(/['’‘ʼ]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function loadBook(file) {
  return JSON.parse(fs.readFileSync(path.join(BOOKS, file), "utf8"));
}

// Индексирует html страницы: englishName(norm) -> {pdfPage, h2, pageName}
function indexPage(pageHtml, pageName, out) {
  const secRe = /<section data-pdf-page="(\d+)">/g;
  const marks = [];
  let m;
  while ((m = secRe.exec(pageHtml))) marks.push({ idx: m.index, page: Number(m[1]) });
  marks.push({ idx: pageHtml.length, page: null });

  let curH2 = "";
  for (let i = 0; i < marks.length - 1; i++) {
    const chunk = pageHtml.slice(marks[i].idx, marks[i + 1].idx);
    const pageNum = marks[i].page;
    const h2m = chunk.match(/<h2>([^<]*)<\/h2>/);
    if (h2m) curH2 = h2m[1].replace(/:$/, "").trim();
    const h4Re = /<h4>([^<]*)<\/h4>/g;
    let hm;
    while ((hm = h4Re.exec(chunk))) {
      const raw = hm[1];
      const slashIdx = raw.indexOf("/");
      if (slashIdx === -1) continue;
      const eng = raw.slice(0, slashIdx).trim();
      const key = normName(eng);
      if (!(key in out)) out[key] = { pdfPage: pageNum, h2: curH2, pageName, raw };
    }
  }
}

function buildIndex() {
  const book = loadBook("core.json");
  const wantPages = new Set(["ПСИХОСИЛЫ", "ФУНДАМЕНТАЛЬНЫЕ ДИСЦИПЛИНЫ", "БОЖЕСТВЕННЫЕ ДИСЦИПЛИНЫ", "РЕДКИЕ ДИСЦИПЛИНЫ"]);
  const out = {};
  for (const entry of book.entries) {
    for (const page of entry.pages ?? []) {
      if (!wantPages.has(page.name)) continue;
      indexPage(page.html ?? "", page.name, out);
    }
  }
  return out;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

function engName(doc) {
  const name = doc.name || "";
  const slash = name.indexOf("/");
  if (slash === -1) return name.trim();
  return name.slice(0, slash).trim();
}

const FOLDERS = ["ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ", "РЕДКИЕ_ДИСЦИПЛИНЫ", "БОЖЕСТВЕННЫЕ_ДИСЦИПЛИНЫ", "ПСИХОСИЛЫ"];

function run({ dry = false } = {}) {
  const idx = buildIndex();
  const report = {};

  for (const folder of FOLDERS) {
    const dir = path.join(PP, folder);
    const files = walk(dir);
    let changed = 0, alreadySet = 0, notFound = 0;
    const misses = [];

    for (const abs of files) {
      const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
      const eng = engName(doc);
      const key = normName(eng);
      const hit = idx[key];

      if (!hit) {
        notFound++;
        misses.push(path.relative(dir, abs).split(path.sep).join("/"));
        continue;
      }

      const discLabel = DISCIPLINE_LABELS[doc.system.discipline] ?? doc.system.discipline;
      let subsection;
      if (FUNDAMENTAL.has(doc.system.discipline)) {
        // hit.h2 — это подтип (совпадает с system.subtype); комбинируем с
        // названием дисциплины, т.к. глава книги общая на все 5 Фундаментальных.
        subsection = `${discLabel} — ${hit.h2}`;
      } else {
        // hit.h2 уже равен discLabel (Психосилы/Редкие/Божественные — проверено).
        subsection = hit.h2 || discLabel;
      }

      const value = `${BOOK_TITLE}, ${hit.pageName} («${subsection}» стр. ${hit.pdfPage})`;

      if (doc.system.bookSource === value) { alreadySet++; continue; }
      doc.system.bookSource = value;
      if (!dry) fs.writeFileSync(abs, JSON.stringify(doc, null, 2) + "\n", "utf8");
      changed++;
    }

    report[folder] = { total: files.length, changed, alreadySet, notFound, misses };
  }

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes("--dry");
  const report = run({ dry });
  for (const [folder, r] of Object.entries(report)) {
    console.log(`\n=== ${folder}: всего ${r.total}, изменено ${r.changed}${dry ? " (dry-run)" : ""}, уже совпадало ${r.alreadySet}, не найдено ${r.notFound}`);
    if (r.misses.length) console.log("  не найдено:", r.misses.join(", "));
  }
}

export { run };
