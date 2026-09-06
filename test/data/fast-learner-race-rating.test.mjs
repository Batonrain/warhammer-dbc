// test/data/fast-learner-race-rating.test.mjs
//
// «Ловит на Лету / Fast Learner (X)» — Черта-шаблон: X разный у рас
// (10/15/20/25, Основная книга). Раса выдаёт её записью Конструктора
// kind:"trait", и рейтинг берётся из ПОЛЯ ЗАПИСИ (mechanics.mjs:2400:
// `if (e.rating !== "" && e.rating != null)`). Пустое поле — молчаливый
// откат на собственный rating шаблона (10), то есть Человек выдавал 10
// вместо 25, а Скват совпадал с книгой случайно.
//
// Здесь сверяется таблица книги с тем, что реально лежит в packs-src:
// рейтинг обязан быть проставлен ЯВНО на каждой расе, дающей эту Черту.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACES_DIR = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src", "races");

/** Основная книга: X у рас, выдающих «Ловит на Лету». */
const BOOK = {
  "Human / Человек": 25,
  "Beastman / Зверолюд": 20,
  "Ratling / Ратлинг": 15,
  "Harpy / Гарпия": 15,
  "Splice / Сплайс": 15,
  "Squat / Скват": 10,
  "Replicant / Репликант": 10
};

function listRaceFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listRaceFiles(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

/** Все записи Конструктора предмета, вложенность нам не важна. */
function mechEntries(node, acc = []) {
  if (Array.isArray(node)) for (const v of node) mechEntries(v, acc);
  else if (node && typeof node === "object") {
    if (typeof node.sourceName === "string" && "rating" in node) acc.push(node);
    for (const v of Object.values(node)) mechEntries(v, acc);
  }
  return acc;
}

const granted = new Map();
for (const file of listRaceFiles(RACES_DIR)) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const e of mechEntries(doc)) {
    if (!/Fast Learner|Ловит на Лету/i.test(e.sourceName)) continue;
    granted.set(doc.name, { rating: e.rating, file });
  }
}

describe("«Ловит на Лету» — рейтинг проставлен на расе, а не унаследован", () => {
  it("выдаёт Черту ровно тот набор рас, что в книге", () => {
    expect([...granted.keys()].sort()).toEqual(Object.keys(BOOK).sort());
  });

  for (const [race, x] of Object.entries(BOOK)) {
    it(`${race} — X = ${x}`, () => {
      const entry = granted.get(race);
      expect(entry, `раса «${race}» не выдаёт «Ловит на Лету»`).toBeTruthy();
      // Пустая строка/null тут — не «0», а откат на шаблон: именно так
      // Человек и получал 10 вместо 25.
      expect(entry.rating, `${entry?.file}: рейтинг не проставлен явно`)
        .not.toBe("");
      expect(Number(entry.rating)).toBe(x);
    });
  }
});
