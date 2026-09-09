// tools/card-description-from-book.mjs
// ════════════════════════════════════════════════════════════════════════
//  ОПИСАНИЯ КАРТОЧЕК ИЗ КНИГ (wdbc-i4y2).
//
//  У 998 документов packs-src пусты ВСЕ поля, где может жить текст правила —
//  карточка не говорит игроку ничего, кроме цифр. Тикет сам называет, с чего
//  начинать: с Элитных Архетипов и Фракций, «у них в книгах заведомо есть
//  описания».
//
//  Проза в книгах лежит одинаково: строка-заголовок с именем, следом один-три
//  абзаца, потом «Требования:» или другой заголовок с двоеточием. Отсюда и
//  разбор: найти имя ОТДЕЛЬНОЙ строкой и взять следующие длинные строки.
//
//  ЧЕГО ИНСТРУМЕНТ НЕ ДЕЛАЕТ:
//   • не берёт текст, если имя встречается заголовком в нескольких книгах —
//     решает человек, из какой книги брать;
//   • не трогает документы, у которых уже есть хоть какой-то текст правила;
//   • не выдумывает: не нашлось строки-заголовка — оставляет пустым.
//
//  ГЛАВНОЕ ОГРАНИЧЕНИЕ — ДВЕ КОЛОНКИ (wdbc-86h). Книга свёрстана в две
//  колонки: заголовки идут парой, абзацы — парой следом. Разбор ищет имя
//  отдельной строкой и берёт следующие длинные строки, поэтому на развороте
//  он способен прихватить абзац СОСЕДА. Так 25 карточек получили чужое
//  описание, и чинили их потом руками (PR #431). Отличить свой абзац от
//  соседнего по одному тексту нечем — значит инструмент и не должен решать
//  это молча: по умолчанию он ПОКАЗЫВАЕТ, что предлагает, а пишет только по
//  явному --write, и каждая запись из нескольких абзацев помечается «глазами»
//  — её надо сверить с разворотом книги.
//
//    node tools/card-description-from-book.mjs [пак]           # показать
//    node tools/card-description-from-book.mjs --write [пак]   # записать
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Поля, где вообще может жить текст правила (перечень из тикета). */
export const TEXT_FIELDS =
  ["description", "benefit", "effect", "notes", "special", "reminder", "afterEffect"];

/** Паки, где книга заведомо даёт прозу. */
export const DEFAULT_PACKS = ["elite-archetypes", "factions", "archetypes"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

const norm = (s) => String(s || "")
  .replace(/­/g, "").replace(/ё/gi, "е").toLowerCase().replace(/\s+/g, " ").trim();

/** Страницы всех книг, разобранные на строки. */
function bookPages() {
  const out = [];
  for (const file of walk(path.join(ROOT, "packs-src/books"))) {
    let book;
    try { book = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    for (const entry of book.entries || []) {
      for (const page of entry.pages || []) {
        const lines = String(page.html || "")
          .replace(/<[^>]+>/g, "\n").replace(/&[a-z]+;/gi, " ")
          .split("\n").map(s => s.replace(/­/g, "").replace(/\s+/g, " ").trim())
          .filter(Boolean);
        out.push({ book: path.basename(file, ".json"), page: page.name, lines });
      }
    }
  }
  return out;
}

/** Проза после строки-заголовка: длинные строки до первого заголовка. */
export function proseAfter(lines, at) {
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/:$/.test(line)) break;               // «Требования:», «Таланты:» …
    if (line.length < 60) break;              // короткая строка — снова заголовок
    out.push(line);
    if (out.length >= 4) break;               // абзацев в книге не больше трёх-четырёх
  }
  return out;
}

/** Найти прозу для имени. null — не нашлось или нашлось в нескольких книгах. */
export function findProse(pages, russianName) {
  const key = norm(russianName);
  const hits = [];
  for (const p of pages) {
    const at = p.lines.findIndex(l => norm(l) === key);
    if (at < 0) continue;
    const prose = proseAfter(p.lines, at);
    if (prose.length) hits.push({ ...p, prose });
  }
  if (hits.length !== 1) return null;
  return hits[0];
}

export function run({ dry = true, packs = DEFAULT_PACKS } = {}) {
  const pages = bookPages();
  const filled = [], skipped = [];
  for (const pack of packs) {
    for (const file of walk(path.join(ROOT, "packs-src", pack))) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      if (!doc?.system) continue;
      const hasText = TEXT_FIELDS.some(k =>
        String(doc.system[k] || "").replace(/<[^>]+>/g, "").trim());
      if (hasText) continue;

      const russian = String(doc.name || "").split("/").pop().trim();
      const hit = findProse(pages, russian);
      if (!hit) { skipped.push({ pack, name: doc.name }); continue; }

      doc.system.description = hit.prose.map(p => `<p>${p}</p>`).join("\n");
      if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
      filled.push({ pack, name: doc.name, from: `${hit.book}/${hit.page}`, paras: hit.prose.length });
    }
  }
  return { filled, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  // Пишем только по явному --write: молчаливая запись — это и есть тот путь,
  // которым 25 карточек получили описание соседа по колонке.
  const dry = !process.argv.includes("--write");
  const pack = process.argv.slice(2).find(a => !a.startsWith("--"));
  const { filled, skipped } = run({ dry, packs: pack ? [pack] : DEFAULT_PACKS });
  for (const f of filled)
    console.log(`+ ${f.name}  ←  ${f.from} (${f.paras} абз.)${f.paras > 1 ? "  ← ГЛАЗАМИ: сверить с разворотом" : ""}`);
  const risky = filled.filter(f => f.paras > 1).length;
  console.log(`\n${dry ? "будет заполнено" : "заполнено"}: ${filled.length} | не нашлось: ${skipped.length}`
    + (risky ? ` | из них ${risky} с несколькими абзацами — сверить с книгой (две колонки, wdbc-86h)` : ""));
  if (dry) console.log("ничего не записано: запись — только с --write");
}
