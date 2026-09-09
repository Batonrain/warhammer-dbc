// tools/race-traits-vs-book.mjs
// ════════════════════════════════════════════════════════════════════════
//  СТАРТОВЫЕ ТРЕЙТЫ РАС ПРОТИВ КНИГИ (wdbc-of5q).
//
//  Повод. Тикет wdbc-w27k искал ПУСТЫЕ рейтинги у выдаваемых Черт и нашёл у
//  Наги один. Сверка её блока с корбуком целиком показала, что неверны были
//  ещё три — и они не пустые, а просто с другим числом: Bite (1) вместо (3),
//  Natural Armour (1) вместо (3), Toxic (1) вместо (3). Ни один перебор по
//  пустым полям такого не видит и увидеть не может — чтобы отличить верную
//  «1» от неверной, нужен текст книги.
//
//  Здесь текст книги и берётся. Список в книге лежит столбиком под заголовком
//  «Стартовые Трейты:» («Bite (3) / Crawler / Dark Sight / …»), а на стороне
//  системы это записи Конструктора kind:"trait" в packs-src/races/**: у каждой
//  есть sourceName («Bite / Укус (X)») и rating.
//
//  ЧТО СЧИТАЕТСЯ РАСХОЖДЕНИЕМ:
//    • Трейт есть в книге и нет в паке (или наоборот);
//    • рейтинг в паке не равен книжному (пустой рейтинг при книжном числе —
//      частный случай, ровно тот, что нашёл w27k).
//
//  Сверка ИМЁН идёт по английской половине: русские переводы в книге и в
//  паке местами разные («Укус» / «Укус (X)»), а английская половина —
//  собственное имя Трейта и не переводится.
//
//    node tools/race-traits-vs-book.mjs          — таблица расхождений
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

/** Английская половина двуязычного имени, без «(X)» и лишних пробелов. */
export function englishHalf(name) {
  const head = String(name || "").split("/")[0];
  return head.replace(/\(.*?\)/g, "").trim().toLowerCase();
}

/** Текст страницы книги без разметки, строками. */
function pageLines(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .split("\n")
    .map(s => s.replace(/­/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Разделы рас на странице: раса → диапазон строк.
 *
 * Опорой служит заголовок «Стартовые Характеристики» — он есть ровно у каждой
 * расы и ровно один раз. Имя расы стоит выше него, отделённое абзацем-другим
 * описания, поэтому от опоры идём НАЗАД до ближайшей строки, которая целиком
 * равна русскому имени одной из известных рас. Искать имя вперёд по тексту
 * нельзя: то же слово встречается в чужих списках Архетипов, и раса тогда
 * забирает чужой блок Трейтов (проверено — Гарпия забирала блок Наги).
 */
function raceSections(lines, russianNames) {
  const anchors = [];
  lines.forEach((l, i) => { if (/^Стартовые\s+Характеристики/i.test(l)) anchors.push(i); });

  // Регистр не значим: книга пишет заголовок раздела прописными («ССЛИТ»), а
  // документ пака — как обычное имя («Сслиты»).
  const byLower = new Map([...russianNames].map(n => [n.toLowerCase(), n]));
  const sections = [];
  anchors.forEach((at, n) => {
    let name = null;
    for (let j = at - 1; j >= 0 && j > at - 40; j--) {
      const hit = byLower.get(String(lines[j]).toLowerCase());
      if (hit) { name = hit; break; }
    }
    if (!name) return;
    sections.push({ name, from: at, to: anchors[n + 1] ?? lines.length });
  });
  return sections;
}

/** Трейты из блока «Стартовые Трейты» внутри раздела расы. */
function bookTraitsIn(lines, section) {
  for (let i = section.from; i < section.to; i++) {
    if (!/^Стартовые\s+Трейты\s*:?$/i.test(lines[i])) continue;
    const traits = [];
    for (let j = i + 1; j < section.to; j++) {
      const line = lines[j];
      if (/:$/.test(line)) break;                        // следующий заголовок
      // Рейтинг в скобках бывает не только числом: «Size (-1)» — отрицательный,
      // «Flyer (A.b×2)» и «Deadly Natural Weapons (2, Когти.Р…)» — формула и
      // уточнение. Прежняя версия ждала только цифр, ломалась на первой такой
      // строке и молча пропускала расу целиком (Ратлинг, Гарпия).
      const m = line.match(/^([A-Za-z][A-Za-z'’\- ]*?)\s*(?:\((.+)\))?$/);
      if (!m) break;                                     // не элемент списка
      const inside = (m[2] ?? "").trim();
      traits.push({ name: normTraitName(m[1]), raw: line,
                    rating: /^-?\d+$/.test(inside) ? Number(inside) : null,
                    ratingText: inside && !/^-?\d+$/.test(inside) ? inside : "" });
    }
    if (traits.length) return traits;
  }
  return null;
}

/**
 * Имя Трейта к общему виду. Книга сокращает характеристику в имени
 * Сверхъестественного («Unnatural S (2)»), пак пишет её словом («Unnatural
 * Strength») — без разворачивания сокращений половина Сверхъестественных
 * читалась бы как «нет такого Трейта» и «лишний Трейт» разом.
 */
const CHAR_WORDS = {
  ws: "weapon skill", bs: "ballistic skill", s: "strength", t: "toughness",
  ag: "agility", a: "agility", i: "initiative", int: "intelligence",
  per: "perception", p: "perception", wp: "willpower", w: "willpower",
  fel: "fellowship", f: "fellowship"
};

export function normTraitName(name) {
  const n = String(name || "").replace(/\(.*?\)/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const m = n.match(/^unnatural\s+([a-z]+)$/);
  if (m && CHAR_WORDS[m[1]]) return `unnatural ${CHAR_WORDS[m[1]]}`;
  return n;
}

/**
 * Трейты, смоделированные не записью Конструктора, а правилом в
 * module/rules/library/**.
 *
 * Часть рас переведена на слой правил (этап 3 плана): у Астартес, например, в
 * паке нет ни одной записи kind:"trait", а Size (1), Unnatural Strength (4) и
 * Unnatural Toughness (4) лежат правилами с говорящими подписями. Без этого
 * источника сверка объявляла бы такую расу потерявшей все свои Трейты сразу.
 *
 * Опознание — по префиксу id правила до первой точки: он совпадает с ключом
 * расы («astartes.size» ← раса с system.key «astartes»).
 *
 * @returns {Map<string, {name:string, rating:?number, raw:string}[]>}
 */
export function rulesLibraryTraits() {
  const byRace = new Map();
  const dir = path.join(ROOT, "module/rules/library");
  if (!fs.existsSync(dir)) return byRace;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".mjs")) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/id:\s*"([\w.-]+)",\s*label:\s*"([^"]+)"/g)) {
      const key = m[1].split(".")[0];
      const label = m[2];
      // Подпись правила двуязычная и несёт рейтинг в скобках, как в книге:
      // «Unnatural Strength (4) / Сверхъестественная Сила (4)».
      const head = label.split("/")[0].trim();
      const rat = head.match(/\((-?\d+)\)/);
      const list = byRace.get(key) ?? [];
      list.push({ name: normTraitName(head), raw: label,
                  rating: rat ? Number(rat[1]) : null });
      byRace.set(key, list);
    }
  }
  return byRace;
}

/** Записи kind:"trait" расы: английское имя и рейтинг. */
export function packTraits(raceDoc) {
  const out = [];
  const groups = raceDoc?.flags?.["warhammer-dbc"]?.mechanics ?? [];
  const scan = (entries) => {
    for (const e of entries || []) {
      if (e?.kind === "group") { scan(e.group?.entries); continue; }
      if (e?.kind !== "trait") continue;
      const rating = String(e.rating ?? "").trim();
      out.push({
        name: normTraitName(englishHalf(e.sourceName)),
        rating: rating === "" ? null : Number(rating),
        raw: String(e.sourceName || "")
      });
    }
  };
  for (const g of groups) scan(g.entries);
  return out;
}

/**
 * Как раса названа в тексте книги против имени документа. Совпадает почти
 * всегда; исключение — Астартес, которого книга по всему разделу зовёт
 * Космодесантником.
 */
const BOOK_NAME_ALIASES = { "Космодесантник": "Астартес" };

/** Русская половина двуязычного имени документа. */
function russianHalf(name) {
  const parts = String(name || "").split("/");
  return (parts[1] ?? parts[0]).trim();
}

/** Страницы ВСЕХ книг, где вообще есть блок «Стартовые Трейты». */
function pagesWithTraits() {
  const out = [];
  for (const file of walk(path.join(ROOT, "packs-src/books"))) {
    let book;
    // Не «пропустить молча»: нечитаемая книга уменьшает число сверенных рас, и
    // сверка тогда врёт в спокойную сторону — «расхождений нет», потому что
    // сверять было не с чем. Один раз так и вышло: книгу писал параллельный
    // агент, JSON был на середине записи, и сверка отчиталась по одной расе
    // вместо одиннадцати.
    try { book = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { throw new Error(`книга ${path.basename(file)} не разбирается: ${e.message}`); }
    for (const entry of book.entries || []) {
      for (const page of entry.pages || []) {
        const lines = pageLines(page.html);
        // Имя страницы идёт первой строкой: у книг Аэльдари раздел расы
        // назван именно страницей («ССЛИТ»), а внутри текста её имени нет.
        if (lines.some(l => /^Стартовые\s+Трейты\s*:?$/i.test(l)))
          out.push([String(page.name || ""), ...lines]);
      }
    }
  }
  return out;
}

/**
 * Сверка рас со ВСЕМИ книгами, а не только со страницей «РАСЫ» корбука.
 *
 * Рейтинги стартовых Трейтов встречаются и в других книгах: Сслиты и
 * друкхари-Недорождённый живут в «Книге Аэльдари: Ответвления», и пока обход
 * шёл по одной странице, они не сверялись вовсе.
 *
 * @returns {{race:string, file:string, problems:string[]}[]}
 */
export function compareRaces() {
  const pages = pagesWithTraits();
  if (!pages.length) throw new Error("ни в одной книге нет блока «Стартовые Трейты» — сверять не с чем");

  const docs = walk(path.join(ROOT, "packs-src/races"))
    .map(file => ({ file, doc: JSON.parse(fs.readFileSync(file, "utf8")) }))
    .filter(({ doc }) => doc.type === "race");

  const byRussian = new Map(docs.map(d => [russianHalf(d.doc.name), d]));
  for (const [inBook, inPack] of Object.entries(BOOK_NAME_ALIASES)) {
    if (byRussian.has(inPack)) byRussian.set(inBook, byRussian.get(inPack));
  }
  const names = new Set(byRussian.keys());
  const fromRules = rulesLibraryTraits();

  const report = [];
  // Раса могла попасть в несколько книг (перепечатка) — сверяем по первой
  // найденной, иначе один и тот же документ отчитывался бы дважды.
  const seen = new Set();
  const sections = pages.flatMap(lines =>
    raceSections(lines, names).map(section => ({ lines, section })));

  for (const { lines, section } of sections) {
    const found = byRussian.get(section.name);
    if (!found || seen.has(found.file)) continue;
    const bookTraits = bookTraitsIn(lines, section);
    if (!bookTraits) continue;
    seen.add(found.file);

    // Трейты расы приходят из двух мест: записи Конструктора в паке и правила
    // слоя правил. Сверять надо объединение — иначе раса, переведённая на
    // правила, читается как потерявшая всё сразу.
    const mine = [...packTraits(found.doc),
                  ...(fromRules.get(String(found.doc.system?.key || "")) ?? [])];
    const problems = [];
    const unchecked = [];
    for (const bt of bookTraits) {
      const got = mine.find(m => m.name === bt.name);
      if (!got) { problems.push(`нет Трейта «${bt.raw}»`); continue; }
      if (bt.rating != null && got.rating !== bt.rating)
        problems.push(`«${got.raw}»: рейтинг ${got.rating ?? "пусто"}, в книге ${bt.rating}`);
      // Нечисловой рейтинг («Flyer (A.b×2)») числом не сверить — называем его
      // отдельно, чтобы он не выглядел проверенным.
      if (bt.ratingText) unchecked.push(`${bt.raw} — рейтинг не число, сверить глазами`);
    }
    // Лишние в ошибки НЕ идут: раса законно несёт больше, чем перечислено в
    // блоке «Стартовые Трейты» — часть Трейтов книга описывает отдельным
    // разделом «Трейты:» ниже, часть приезжает субрасой. Считать их
    // расхождением значило бы утопить настоящие находки в шуме.
    const extra = mine.filter(m => !bookTraits.some(bt => bt.name === m.name)).map(m => m.raw);

    report.push({ race: found.doc.name, file: path.relative(ROOT, found.file).replace(/\\/g, "/"),
                  bookCount: bookTraits.length, packCount: mine.length,
                  problems, unchecked, extra });
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const report = compareRaces();
  const bad = report.filter(r => r.problems.length);
  for (const r of bad) {
    console.log(`\n### ${r.race}   (книга ${r.bookCount}, пак ${r.packCount})   ${r.file}`);
    for (const p of r.problems) console.log(`   • ${p}`);
  }
  const grey = report.filter(r => r.unchecked.length);
  if (grey.length) {
    console.log("\n— рейтинги, которые числом не сверить (смотреть глазами):");
    for (const r of grey) for (const u of r.unchecked) console.log(`   ${r.race}: ${u}`);
  }
  console.log(`\nсверено рас: ${report.length}, с расхождениями: ${bad.length}, всего расхождений: ${bad.reduce((n, r) => n + r.problems.length, 0)}`);
}
