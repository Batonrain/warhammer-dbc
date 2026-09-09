// test/tools/pack-path-in-tests.test.mjs
//
// СТОРОЖ: тест не читает документ пака по имени файла (wdbc-hhka).
//
// Имя файла в packs-src выводится из имени документа (tools/pack-file-name.mjs)
// и меняется вместе с ним. Тест, прописавший путь строкой, после переименования
// предмета падает с ENOENT — и падение выглядит как «пак развалился», хотя
// развалился только тест. За один заход правки названий (wdbc-o30i, wdbc-yubg)
// так упало два теста подряд.
//
// Правильный способ — test/support/pack-doc.mjs: packDocById(dir, id) или
// packDocByFileHint(path). Идентификатор при переименовании не меняется.
//
// Проверяется не «нет строк с именем файла» (они остаются как подпись, по ним
// видно, о каком предмете речь), а то, что документ по такой строке НЕ читают
// напрямую: строка идёт в помощник, а не в readFileSync.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".test.mjs")) out.push(p);
  }
  return out;
}

/** Чтение файла пака напрямую: readFileSync внутри JSON.parse. */
const DIRECT_READ = /JSON\.parse\(\s*(?:fs\.)?readFileSync\(/;

// Имя файла ДОКУМЕНТА пака — «Имя_<id16>.json». Именно оно и меняется при
// переименовании. Файлы книг (packs-src/books/core.json) сюда не попадают:
// их имя — постоянный слаг книги, а не имя документа.
const DOC_FILE_NAME = /_[A-Za-z0-9]{16}\.json/;

describe("тесты не читают документы пака по имени файла", () => {
  const files = walk(path.join(ROOT, "test"));

  it("тесты вообще нашлись — иначе сторож зелен от пустоты", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("ни один тест не открывает packs-src напрямую", () => {
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      if (!src.includes("packs-src")) continue;
      if (!DOC_FILE_NAME.test(src)) continue;
      if (!DIRECT_READ.test(src)) continue;
      // Обходы пака целиком (readdir по каталогу) — законный случай: они не
      // зависят от конкретного имени файла и от переименования не ломаются.
      if (/readdirSync|walk\(/.test(src)) continue;
      offenders.push(path.relative(ROOT, file).split(path.sep).join("/"));
    }
    expect(offenders, "читают пак напрямую вместо test/support/pack-doc.mjs:\n"
      + offenders.join("\n")).toEqual([]);
  });
});
