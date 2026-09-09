// tools/original-names-from-books.mjs
// ════════════════════════════════════════════════════════════════════════
//  ОРИГИНАЛЬНЫЕ НАЗВАНИЯ ИЗ КНИГ (wdbc-o30i).
//
//  В проекте принято имя предмета вида «English Name / Русское Имя»:
//  оригинал книги слева, перевод справа. Соблюдается это не везде — у
//  полутора тысяч записей packs-src английской половины нет вовсе, и тогда
//  предмет физически не с чем сверять: в игре он называется одним словом, в
//  книге другим, и связать их нечем. Больше всего дыра у Оружия, Брони и
//  Боеприпасов — ровно у того, что игрок держит в руках чаще всего.
//
//  Здесь — механическая часть работы: книги СAМИ содержат пары «English /
//  Русский» в таблицах и заголовках, и по русской половине к большинству
//  предметов можно найти английскую.
//
//  ЧЕГО ЭТОТ ИНСТРУМЕНТ НЕ ДЕЛАЕТ. Он не пишет в паки: сопоставление по
//  русской половине даёт ложные срабатывания на похожих названиях
//  («Силовой Меч» против «Силовой Меч Легиона»), и решение по каждому
//  спорному случаю принимает человек. Инструмент отдаёт таблицу
//  «предмет → найденный оригинал → в какой книге», а также отдельно
//  перечисляет неоднозначные случаи, где по одному русскому имени в книгах
//  нашлось НЕСКОЛЬКО разных английских.
//
//  ЛОВУШКИ РАЗМЕТКИ, из-за которых наивный поиск не работает:
//   • разделитель бывает без пробела слева («Daemonic Uplink /Демоническое»);
//   • дефис в русской половине часто набран длинным тире («Клюв–Зажим»);
//   • книга переносит слова через мягкий перенос (U+00AD) внутри слова;
//   • «ё» пишется то так, то как «е».
//
//    node tools/original-names-from-books.mjs            — сводка
//    node tools/original-names-from-books.mjs <пак>      — таблица по паку
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

/** Русское имя к сравнимому виду: без «ё», тире, регистра и лишних пробелов. */
export function normRu(s) {
  return String(s || "")
    .replace(/­/g, "")
    .replace(/[–—−-]/g, "-")
    .replace(/ё/gi, "е")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LATIN = /[A-Za-z]/;
const CYRIL = /[А-Яа-яЁё]/;

/**
 * Все пары «English / Русский», встречающиеся в текстах книг.
 * @returns {{pairs: Map<string, Set<string>>, unreadable: string[]}}
 */
export function bookNamePairs() {
  const pairs = new Map();
  const unreadable = [];
  for (const file of walk(path.join(ROOT, "packs-src/books"))) {
    let book;
    try { book = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch { unreadable.push(path.basename(file)); continue; }

    const text = (book.entries || [])
      .flatMap(e => e.pages || [])
      .map(p => `${p.name}\n${String(p.html || "").replace(/<[^>]+>/g, "\n")}`)
      .join("\n")
      .replace(/&[a-z]+;/gi, " ");

    for (const line of text.split("\n")) {
      const s = line.replace(/­/g, "").trim();
      // «English Name / Русское Имя» — по одной паре на строку. Разделитель с
      // необязательным пробелом слева: книга пишет и «A / Б», и «A /Б».
      const m = s.match(/^([A-Za-z][A-Za-z''.\-\d\s()]{2,60}?)\s*\/\s*([А-ЯЁ][^/|]{2,60})$/);
      if (!m) continue;
      const en = m[1].trim();
      const ru = m[2].trim();
      if (!LATIN.test(en) || !CYRIL.test(ru)) continue;
      const key = normRu(ru);
      const set = pairs.get(key) ?? new Set();
      set.add(en);
      pairs.set(key, set);
    }
  }
  return { pairs, unreadable };
}

/** Есть ли у документа английская половина имени. */
export function hasOriginal(doc) {
  if (String(doc?.system?.originalName || "").trim() !== "") return true;
  const head = String(doc?.name || "").split("/")[0];
  return LATIN.test(head);
}

/**
 * Что можно достать из книг для предметов без оригинала.
 * @param {string} [onlyPack] ограничить одним паком
 */
export function proposals(onlyPack = "") {
  const { pairs, unreadable } = bookNamePairs();
  const packsDir = path.join(ROOT, "packs-src");
  const packs = fs.readdirSync(packsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== "books")
    .map(e => e.name)
    .filter(n => !onlyPack || n === onlyPack);

  const found = [], ambiguous = [], missing = [];
  for (const pack of packs) {
    for (const file of walk(path.join(packsDir, pack))) {
      if (file.endsWith("_Folder.json")) continue;
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      if (!doc?.name || hasOriginal(doc)) continue;

      const hit = pairs.get(normRu(doc.name));
      const row = { pack, name: doc.name, file: path.relative(ROOT, file).replace(/\\/g, "/") };
      if (!hit) missing.push(row);
      else if (hit.size === 1) found.push({ ...row, original: [...hit][0] });
      else ambiguous.push({ ...row, variants: [...hit] });
    }
  }
  return { found, ambiguous, missing, unreadable };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const onlyPack = process.argv[2] || "";
  const { found, ambiguous, missing, unreadable } = proposals(onlyPack);
  if (unreadable.length) console.log(`ВНИМАНИЕ: не разобрались книги: ${unreadable.join(", ")}\n`);
  if (onlyPack) {
    for (const r of found)     console.log(`+ ${r.name}  →  ${r.original}`);
    for (const r of ambiguous) console.log(`? ${r.name}  →  ${r.variants.join(" | ")}`);
    for (const r of missing)   console.log(`— ${r.name}`);
  } else {
    const by = new Map();
    for (const [kind, list] of [["найдено", found], ["неоднозначно", ambiguous], ["нет в книгах", missing]])
      for (const r of list) {
        const row = by.get(r.pack) ?? { найдено: 0, неоднозначно: 0, "нет в книгах": 0 };
        row[kind]++; by.set(r.pack, row);
      }
    console.log("пак".padEnd(20), "найдено", "неодн.", "нет в книгах");
    for (const [pack, row] of [...by].sort((a, b) => b[1]["найдено"] - a[1]["найдено"]))
      console.log(pack.padEnd(20), String(row["найдено"]).padStart(7), String(row["неоднозначно"]).padStart(6), String(row["нет в книгах"]).padStart(13));
  }
  console.log(`\nбез оригинала: ${found.length + ambiguous.length + missing.length}`
            + ` | найдено однозначно: ${found.length}`
            + ` | неоднозначно: ${ambiguous.length}`
            + ` | нет в книгах: ${missing.length}`);
}
