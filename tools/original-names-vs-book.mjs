// tools/original-names-vs-book.mjs
// ════════════════════════════════════════════════════════════════════════
//  ОРИГИНАЛЬНЫЕ НАЗВАНИЯ ПРОТИВ ТЕКСТА КНИГ (wdbc-teyu).
//
//  Английская половина имени — это название из книги, и по нему сверяются с
//  первоисточником. Первый замер тикета показал, что 1005 из 4600 таких имён
//  дословно в книгах не находятся, и сам же честно оговорил: цифра — верхняя
//  граница, а не число ошибок.
//
//  Здесь тот же замер, но с отсевом шума, который тикет назвал поимённо:
//
//   1. ТИПОГРАФСКИЙ АПОСТРОФ. «The Hydra's Hand» у нас против «The Hydra’s
//      Hand» (U+2019) в книге. Расхождения по сути нет.
//   2. НАШЕ СКОБОЧНОЕ УТОЧНЕНИЕ. «Unnatural WS, BS (2)», «Aeldarii (Citizen)»
//      — в книге таких строк нет, потому что скобки добавили мы. Сверяем
//      часть до скобки.
//   3. СЛУЖЕБНЫЕ ЗАПИСИ. Папки (_Folder.json) и записи без имени.
//   4. ПЕРЕЧИСЛЕНИЕ ЧЕРЕЗ ЗАПЯТУЮ. «Unnatural WS, BS» — наша склейка двух
//      книжных Трейтов в один предмет; в книге они по отдельности. Проверяем
//      каждую часть.
//
//  Остаток делится на два ведра, и это разные задачи:
//   • «в книге написано иначе» — имя есть в книгах, но с другим написанием
//     (регистр, дефис, лишнее слово). Чинить пак.
//   • «в книге не нашлось вовсе» — сперва проверить, вычитана ли книга: обе
//     книги Аэльдари помечены checked:0, и тогда чинить надо транскрипцию, а
//     не пак.
//
//    node tools/original-names-vs-book.mjs           — сводка по пакам
//    node tools/original-names-vs-book.mjs <пак>     — список по паку
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

/** Английское имя к сравнимому виду: апостроф, тире, кавычки, регистр, пробелы. */
export const normEnText = (s) => String(s || "")
  .replace(/­/g, "")
  .replace(/[''`´]/g, "'")
  .replace(/[–—−]/g, "-")
  .replace(/[«»""„“”]/g, '"')
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

/** Весь текст книг одной строкой — нормализуется ОДИН раз, иначе прогон минуты. */
export function bookHaystack() {
  const parts = [];
  for (const file of walk(path.join(ROOT, "packs-src/books"))) {
    let book;
    try { book = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    for (const entry of book.entries || []) {
      parts.push(entry.name || "");
      for (const page of entry.pages || []) {
        parts.push(page.name || "");
        parts.push(String(page.html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " "));
      }
    }
  }
  return normEnText(parts.join(" "));
}

/**
 * Куски английского имени, которые надо искать в книге по отдельности.
 * «Unnatural WS, BS (2)» → ["unnatural ws", "bs"]: скобка наша, а перечисление
 * через запятую — склейка двух книжных Трейтов в один предмет пака.
 */
export function searchablePieces(english) {
  const base = String(english || "").replace(/\(.*?\)/g, " ");
  return base.split(",")
    .map(s => normEnText(s))
    .filter(s => s.length >= 3);
}

/** Записи, чьё оригинальное имя в книгах не нашлось. */
export function compareOriginalNames(onlyPack = "") {
  const hay = bookHaystack();
  const packsDir = path.join(ROOT, "packs-src");
  const packs = fs.readdirSync(packsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== "books")
    .map(e => e.name)
    .filter(n => !onlyPack || n === onlyPack);

  const stats = new Map();
  const missing = [];
  for (const pack of packs) {
    let total = 0, notFound = 0;
    for (const file of walk(path.join(packsDir, pack))) {
      if (file.endsWith("_Folder.json")) continue;
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      const parts = String(doc?.name || "").split("/");
      if (parts.length !== 2) continue;
      const english = parts[0].trim();
      if (!/[A-Za-z]/.test(english)) continue;
      total++;
      const pieces = searchablePieces(english);
      if (!pieces.length || pieces.every(p => hay.includes(p))) continue;
      notFound++;
      // Русская половина в книгах ЕСТЬ, а английской нет — значит книга для
      // этой записи английского названия не даёт вовсе (она русскоязычная), и
      // английскую половину дописали мы. Это не ошибка сверки с книгой, а наше
      // дополнение: сверять его не с чем. Отделяем от настоящих расхождений.
      // У русской половины снимаем то же, что у английской, плюс наш
      // префикс-категорию: «Дар: Звериные Ноги» в книге называется просто
      // «Звериные Ноги», и без снятия префикса запись ложно числилась бы
      // не найденной ни на одном языке.
      const russian = normEnText(parts[1].trim()
        .replace(/^[А-ЯЁа-яё]+:\s*/, "")
        .replace(/\(.*?\)/g, " "));
      const ruInBook = russian.length >= 3 && hay.includes(russian);
      missing.push({ pack, name: doc.name, english, ruInBook,
                     file: path.relative(ROOT, file).split(path.sep).join("/") });
    }
    if (total) stats.set(pack, { total, notFound });
  }
  return { stats, missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const onlyPack = process.argv[2] || "";
  const { stats, missing } = compareOriginalNames(onlyPack);
  if (onlyPack) {
    for (const m of missing)
      console.log(`  ${m.ruInBook ? "наше" : "НЕТ  "}  ${m.english}      [${m.name}]`);
  } else {
    console.log("пак".padEnd(20), "с оригиналом", "не найдено", "доля");
    for (const [pack, s] of [...stats].sort((a, b) => b[1].notFound - a[1].notFound)) {
      if (!s.notFound) continue;
      console.log(pack.padEnd(20), String(s.total).padStart(12), String(s.notFound).padStart(10),
                  `${Math.round(s.notFound / s.total * 100)}%`.padStart(6));
    }
  }
  const total = [...stats.values()].reduce((n, s) => n + s.total, 0);
  const coined = missing.filter(m => m.ruInBook).length;
  console.log(`\nс оригинальным именем: ${total} | английского нет в книгах: ${missing.length}`);
  console.log(`из них у ${coined} русское имя в книгах ЕСТЬ — книга там даёт только`
            + ` русское название, английскую половину дописали мы (сверять не с чем);`);
  console.log(`не нашлось ни английского, ни русского: ${missing.length - coined}`);
}
