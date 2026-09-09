// tools/russian-names-vs-book.mjs
// ════════════════════════════════════════════════════════════════════════
//  РУССКИЕ НАЗВАНИЯ ПРЕДМЕТОВ ПРОТИВ КНИГИ (wdbc-yubg).
//
//  Русские названия в компендиумах местами не совпадают с книжными: в книге
//  «Катушка Потенции», в игре «Потенциа Коил». Игрок ищет то, что видел в
//  книге, и не находит.
//
//  ПОЧЕМУ ЗДЕСЬ НЕ ПОИСК РУССКОГО ИМЕНИ ПО ТЕКСТУ КНИГ. Так мерил первый
//  замер (тикет), и он давал 31% «расхождений» у оружия — почти всё шум:
//  свой префикс-категория, длинное тире, папки-заголовки. Здесь сверка
//  прицельная: у имени есть английская половина, книга даёт для этой
//  английской свою русскую — сравниваются ровно две русские половины одной
//  и той же записи.
//
//  ЧЕТЫРЕ ВИДА ШУМА, которые отсекаются как НЕ расхождение:
//   1. Наш суффикс рейтинга «(X)»: книга пишет «Страх», мы «Страх (X)».
//   2. Наш префикс-категория: «Дар: Ментор» против книжного «Ментор».
//   3. Наше уточнение в скобках для одноимённых записей: «Жестокость
//      (Дредноут)», «Осколочная Пушка (техн.)» — книга различает их
//      контекстом главы, пак не может, имена в паке видны одним списком.
//   4. Типографика: кавычки «ёлочки» против прямых, длинное тире против
//      дефиса, «ё», двойные пробелы. Книга набрана типографски, пак — нет.
//
//  ЧЕГО ИНСТРУМЕНТ НЕ РЕШАЕТ. Иногда книга сама набрана с опечаткой («Чем бы
//  дитя не тешилось», «Голполе эльдар», двойные пробелы в имени). Переносить
//  такое дословно значило бы тащить опечатку в игру, поэтому такие случаи
//  инструмент показывает, но решение — за человеком.
//
//    node tools/russian-names-vs-book.mjs           — список расхождений
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

/** Английская половина к сравнимому виду: без «(X)», кавычек и регистра. */
export const normEn = (s) => String(s || "")
  .toLowerCase().replace(/[''`]/g, "'")
  .replace(/\s*\((?:x|\d+)\)\s*$/, "")
  .replace(/\s+/g, " ").trim();

/**
 * Русская половина к сравнимому виду. Снимается всё, что перечислено в шапке
 * как шум: наш префикс-категория, любые скобки (и наш рейтинг «(X)», и наше
 * уточнение), типографика.
 */
export const normRuName = (s) => String(s || "")
  .trim()                                 // половина имени приходит с пробелом от «/»
  .replace(/^[А-ЯЁа-яё]+:\s*/, "")        // «Дар: Ментор» → «Ментор»
  .replace(/\(.*?\)/g, " ")               // «Страх (X)», «Жестокость (Дредноут)»
  .replace(/[«»""„“”"'`]/g, "")
  .replace(/[–—−]/g, "-")
  .replace(/ё/gi, "е")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

/** Пары «English / Русский» из всех книг: english → набор русских вариантов. */
export function bookPairsByEnglish() {
  const byEn = new Map();
  for (const file of walk(path.join(ROOT, "packs-src/books"))) {
    let book;
    try { book = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    const text = (book.entries || []).flatMap(e => e.pages || [])
      .map(p => `${p.name}\n${String(p.html || "").replace(/<[^>]+>/g, "\n")}`)
      .join("\n").replace(/&[a-z]+;/gi, " ");
    for (const line of text.split("\n")) {
      const s = line.replace(/­/g, "").trim();
      const m = s.match(/^([A-Za-z][A-Za-z''.\-\d\s()]{2,60}?)\s*\/\s*([А-ЯЁ][^/|]{2,60})$/);
      if (!m) continue;
      const key = normEn(m[1]);
      const set = byEn.get(key) ?? new Set();
      set.add(m[2].trim());
      byEn.set(key, set);
    }
  }
  return byEn;
}

/** Расхождения перевода: наша русская половина не совпала ни с одной книжной. */
export function compareRussianNames() {
  const byEn = bookPairsByEnglish();
  const out = [];
  for (const pack of fs.readdirSync(path.join(ROOT, "packs-src"), { withFileTypes: true })) {
    if (!pack.isDirectory() || pack.name === "books") continue;
    for (const file of walk(path.join(ROOT, "packs-src", pack.name))) {
      if (file.endsWith("_Folder.json")) continue;
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      const parts = String(doc?.name || "").split("/");
      if (parts.length !== 2) continue;
      const book = byEn.get(normEn(parts[0]));
      if (!book) continue;
      const ours = normRuName(parts[1]);
      // Три уровня «то же самое»:
      //   1) после снятия шума совпало дословно;
      //   2) совпало без дефисов и пробелов — «Фраг-Пушка» против «Фраг Пушка»
      //      и «Граврепульсоры» против «Грав-репульсоры» — это орфография
      //      сложных слов, а не другое название;
      //   3) книжный вариант НАЧИНАЕТСЯ с нашего — в книге к строке таблицы
      //      прилип хвост соседней колонки («Цепкий Даташип — Хв: Хв»), это
      //      мусор разбора, а не часть имени.
      const letters = t => t.replace(/[^а-я0-9]/gi, "");
      if ([...book].some(b => {
        const bn = normRuName(b);
        return bn === ours || letters(bn) === letters(ours) || bn.startsWith(ours + " ");
      })) continue;
      out.push({
        pack: pack.name, name: doc.name, id: doc._id,
        ours: parts[1].trim(), book: [...book],
        file: path.relative(ROOT, file).split(path.sep).join("/")
      });
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const diffs = compareRussianNames();
  const byPack = {};
  for (const d of diffs) (byPack[d.pack] ??= []).push(d);
  for (const [pack, list] of Object.entries(byPack)) {
    console.log(`### ${pack} (${list.length})`);
    for (const d of list) console.log(`  ${d.ours}   ←книга→   ${d.book.join(" | ")}      [${d.name}]`);
  }
  console.log(`\nрасхождений перевода: ${diffs.length}`);
}
