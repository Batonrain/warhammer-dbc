// test/data/ship-hull-spc-vs-book.test.mjs
//
// Числа корабельных записей в паке против статблоков Книги Пустоты.
//
// ПОЧЕМУ ЭТОТ СТОРОЖ ЕСТЬ. Дважды подряд, в двух разных стопках, корабельные
// записи уезжали ровно на +4 под коммитом, который сообщал, что значения
// «сверены с книжными статблоками»:
//   • 10.09.2026 (приём #441-#462): 156 записей — у корпусов `hull.spaceMax`
//     +4, у двигателей `power` −4 (то есть выработка +4). Откачено.
//   • 14.09.2026 (приём #478-#481): то же самое вернулось и расширилось —
//     `hull.spaceMax` +4 у 77 корпусов, `power` −4 у 55 двигателей,
//     `sp` +4 у 13 Линейных крейсеров. Откачено повторно.
// Дельта оба раза была одинаковой у ВСЕХ записей, без единого исключения —
// то есть это арифметика по маске каталогов, а не сверка с книгой. Поймать
// такое глазами в дифе на полторы сотни файлов невозможно: каждая отдельная
// строка выглядит правдоподобно.
//
// ПОЧЕМУ СТОРОЖ РАСШИРЕН. Первая его версия сверяла ТОЛЬКО таблицу
// «Транспорты» — по замыслу «любой сдвиг по маске задевает и её». Второй заход
// это опроверг: он обошёл Транспорты стороной и прошёл мимо зелёного теста.
// Поэтому теперь сверяются ВСЕ восемь классовых таблиц книги (заголовок
// «Класс | SPD | MN | DT | HI | ARM | TR | SPC | SP | WC | T | Свойства»)
// по двум числам сразу — SPC и SP, — и отдельно P.Gen плазменных двигателей.
//
// Сопоставление идёт ПО ПАПКАМ (страница книги ↔ каталог пака), а не по
// общему словарю имён: «Опустошение» есть и среди Крейсеров, и среди
// Рейдеров, «Голиаф» — и транспорт, и другое судно, и плоский словарь
// склеивал бы разные корабли.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HULL_HEAD = ["Класс", "SPD", "MN", "DT", "HI", "ARM", "TR", "SPC", "SP", "WC", "T", "Свойства"];
const DRIVE_HEAD = ["Двигатель", "Корпуса", "Свойства", "P. Gen", "SPC", "SP", "R"];

/** Страница книги → каталог пака. Обе стороны перечислены поимённо нарочно:
 *  новый класс кораблей должен попасть сюда руками, иначе он тихо окажется
 *  вне сверки — ровно та дыра, через которую прошёл второй сдвиг. */
const PAGE_TO_DIR = {
  "Транспорты": "Транспорты",
  "Рейдеры": "Рейдеры",
  "Фрегаты": "Фрегаты",
  "Легкие крейсеры": "Л_гкие_крейсеры",
  "Крейсеры": "Крейсеры",
  "Линейные крейсеры": "Линейные_крейсеры",
  "Гранд-крейсеры": "Гранд_крейсеры",
  "Линкоры": "Линкоры"
};

/** Русское написание в паке намеренно расходится с книжной таблицей: в самой
 *  книге эти корабли названы по-разному в разных местах, и пак взял ту форму,
 *  которая в книге встречается чаще и верна по-русски (wdbc-teyu, 12.09.2026).
 *  Список закрытый: новое расхождение тест обязан уронить, а не замолчать. */
const PACK_SPELLING = {
  "Каррака": "Каракка",       // книга пишет и так, и так
  "Экцельсиор": "Эксельсиор", // Excelsior
  "Одиссея": "Одиссей"        // Odysseus — человек, не поэма
};

/** Все узлы книги с полем html, на любой глубине вложенности. */
function* htmlNodes(node) {
  if (Array.isArray(node)) { for (const v of node) yield* htmlNodes(v); return; }
  if (node && typeof node === "object") {
    if (typeof node.html === "string") yield node;
    for (const v of Object.values(node)) yield* htmlNodes(v);
  }
}

const bookPages = (() => {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, "packs-src/books/void.json"), "utf8"));
  return [...htmlNodes(book)].map(p => ({
    name: p.name,
    cells: p.html.replace(/<[^>]+>/g, "|").split("|").map(c => c.trim()).filter(Boolean)
  }));
})();

/** Строки таблицы с заголовком `head`, начиная с каждого его вхождения. */
function tableRows(cells, head) {
  const out = [];
  for (let i = cells.indexOf(head[0]); i !== -1; i = cells.indexOf(head[0], i + 1)) {
    if (!head.every((h, k) => cells[i + k] === h)) continue;
    for (let j = i + head.length; j + head.length <= cells.length; j += head.length) {
      const row = cells.slice(j, j + head.length);
      // Таблица кончилась там, где на месте числовой колонки не число.
      if (!Number.isFinite(Number(row[head.indexOf("SPC")]))) break;
      out.push(row);
    }
  }
  return out;
}

/** Русская половина двуязычного названия документа. */
const ruName = name => {
  const ru = String(name).split("/").pop().trim();
  const quoted = ru.match(/[«„"]([^»“"]+)[»“"]/);
  return (quoted ? quoted[1] : ru).trim();
};

const packDocs = dir => {
  const d = path.join(ROOT, "packs-src/ship-components", dir);
  return fs.readdirSync(d)
    .filter(f => f.endsWith(".json") && !f.startsWith("_Folder"))
    .map(f => JSON.parse(fs.readFileSync(path.join(d, f), "utf8")));
};

describe("Корпуса: SPC и SP совпадают с классовыми таблицами Книги Пустоты", () => {
  const compared = [];
  const unmatched = [];
  const wrong = [];

  for (const [page, dir] of Object.entries(PAGE_TO_DIR)) {
    const cells = bookPages.find(p => p.name === page)?.cells ?? [];
    const rows = tableRows(cells, HULL_HEAD);
    const pack = new Map(packDocs(path.join("Корпуса", dir)).map(d => [ruName(d.name), d]));
    for (const row of rows) {
      const cls = PACK_SPELLING[row[0]] ?? row[0];
      const doc = pack.get(cls);
      if (!doc) { unmatched.push(`${page}/${row[0]}`); continue; }
      compared.push(`${page}/${cls}`);
      const spc = Number(row[HULL_HEAD.indexOf("SPC")]);
      const sp = Number(row[HULL_HEAD.indexOf("SP")]);
      if (doc.system?.hull?.spaceMax !== spc)
        wrong.push(`SPC ${page}/${cls}: книга ${spc}, пак ${doc.system?.hull?.spaceMax}`);
      if (doc.system?.sp !== sp)
        wrong.push(`SP ${page}/${cls}: книга ${sp}, пак ${doc.system?.sp}`);
    }
  }

  it("все восемь классовых таблиц книги разобрались", () => {
    // Страховка от «тест зелен, потому что ничего не разобрал».
    expect(compared.length + unmatched.length).toBeGreaterThanOrEqual(110);
  });

  it("у каждого класса книги есть запись в паке", () => {
    // Переименование, уводящее пак от книжного названия, не должно молча
    // выводить корабль из-под сверки — либо правится имя, либо PACK_SPELLING.
    expect(unmatched).toEqual([]);
  });

  it("SPC и SP каждого корпуса совпадают с книгой", () => {
    expect(wrong).toEqual([]);
  });
});

describe("Плазменные двигатели: выработка совпадает с книгой", () => {
  // В паке выработка хранится ОТРИЦАТЕЛЬНОЙ (`power: -35` — двигатель даёт
  // мощность, узлы её тратят), в книге тот же показатель записан
  // положительным числом в колонке «P. Gen».
  //
  // Сверяются только двигатели с уникальным именем в книжной таблице: один
  // «Мимикрирующий двигатель» стоит в ней тремя строками под разные классы
  // корпусов, и различать их пришлось бы сверкой написания классов — лишняя
  // хрупкость ради трёх записей. Массовый сдвиг задевает не их одних.
  const cells = bookPages.find(p => p.name === "Плазменные двигатели")?.cells ?? [];
  const rows = tableRows(cells, DRIVE_HEAD);
  const seen = new Map();
  for (const row of rows) seen.set(row[0], (seen.get(row[0]) ?? 0) + 1);
  const unique = new Map(rows.filter(r => seen.get(r[0]) === 1)
    .map(r => [r[0], Number(r[DRIVE_HEAD.indexOf("P. Gen")])]));

  const pack = new Map(packDocs("Плазменные_двигатели").map(d => [ruName(d.name), d]));
  const wrong = [];
  let compared = 0;
  for (const [engine, pgen] of unique) {
    const doc = pack.get(engine);
    if (!doc) continue;
    compared++;
    if (doc.system?.power !== -pgen)
      wrong.push(`${engine}: книга ${pgen}, пак ${-doc.system?.power}`);
  }

  it("книжная таблица двигателей разобралась и сопоставилась", () => {
    expect(compared).toBeGreaterThanOrEqual(20);
  });

  it("у каждого сопоставленного двигателя выработка равна книжной", () => {
    expect(wrong).toEqual([]);
  });
});
