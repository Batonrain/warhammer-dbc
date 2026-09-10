// test/data/ship-hull-spc-vs-book.test.mjs
//
// Пространство корпуса (SPC) в паке против таблицы Книги Пустоты.
//
// Заведён при приёме второй партии PR #462 (10.09.2026). Там 156 корабельных
// записей уехали ровно на +4: у 101 корпуса `hull.spaceMax` +4, у 55 двигателей
// `power` −4 (то есть выработка +4). Дельта была одинаковой у ВСЕХ, без единого
// исключения, а папка `Корпуса/Линейные_крейсеры` осталась нетронутой — то есть
// это была арифметическая операция по маске каталогов, а не сверка с книгой.
// Сообщение коммита при этом гласило «сверены с книжными статблоками».
// Поймать такое глазами в дифе на 156 файлов невозможно: каждая отдельная
// строка выглядит правдоподобно.
//
// Сверяется таблица «Транспорты» (стр. 80) — единственная в книге, где класс
// корпуса назван тем же словом, что и документ пака, поэтому сопоставление
// однозначно и не требует словаря синонимов. Этого достаточно: любой сдвиг «по
// маске» задевает и её.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Все узлы книги с полем html, на любой глубине вложенности. */
function* htmlNodes(node) {
  if (Array.isArray(node)) { for (const v of node) yield* htmlNodes(v); return; }
  if (node && typeof node === "object") {
    if (typeof node.html === "string") yield node;
    for (const v of Object.values(node)) yield* htmlNodes(v);
  }
}

/** Таблица «Транспорты» из Книги Пустоты → { имя класса: SPC }. */
function bookTransportSpc() {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, "packs-src/books/void.json"), "utf8"));
  for (const page of htmlNodes(book)) {
    if (!page.html.includes("SPC") || !page.html.includes("Иерихон")) continue;
    const cells = page.html.replace(/<[^>]+>/g, "|").split("|").map(c => c.trim()).filter(Boolean);
    const head = cells.indexOf("Класс");
    if (head === -1) continue;
    const cols = cells.slice(head, head + 12);
    const spcAt = cols.indexOf("SPC");
    const width = cols.length;
    const out = {};
    for (let i = head + width; i + width <= cells.length; i += width) {
      const row = cells.slice(i, i + width);
      const spc = Number(row[spcAt]);
      if (!Number.isFinite(spc)) break;      // таблица кончилась
      out[row[0]] = spc;
    }
    return out;
  }
  return {};
}

/** Корпуса транспортов из пака → { имя из названия документа: spaceMax }. */
function packTransportSpc() {
  const dir = path.join(ROOT, "packs-src/ship-components/Корпуса/Транспорты");
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json") || f.startsWith("_Folder")) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    // Название вида «Jericho Class Transport / Транспорт класса „Иерихон“» —
    // ключом берём русское слово в кавычках или последнее слово после «/».
    const ru = String(doc.name).split("/").pop();
    const m = ru.match(/[«„"]([^»“"]+)[»“"]/);
    const key = (m ? m[1] : ru).trim();
    out[key] = doc.system?.hull?.spaceMax;
  }
  return out;
}

describe("SPC корпусов транспортов совпадает с Книгой Пустоты", () => {
  const book = bookTransportSpc();
  const pack = packTransportSpc();

  it("таблица «Транспорты» из книги разобралась", () => {
    expect(Object.keys(book).length).toBeGreaterThanOrEqual(10);
    expect(book["Иерихон"]).toBe(45);
  });

  it("в паке нашлись корпуса транспортов", () => {
    expect(Object.keys(pack).length).toBeGreaterThanOrEqual(10);
  });

  it("у каждого класса, который есть и в книге, и в паке, SPC совпадает", () => {
    const mismatched = [];
    let compared = 0;
    for (const [cls, spc] of Object.entries(book)) {
      if (!(cls in pack)) continue;
      compared++;
      if (pack[cls] !== spc) mismatched.push(`${cls}: книга ${spc}, пак ${pack[cls]}`);
    }
    // Страховка от «тест зелен, потому что ничего не сопоставил».
    expect(compared).toBeGreaterThanOrEqual(8);
    expect(mismatched).toEqual([]);
  });
});
