// test/constants-orphans.test.mjs
//
// module/constants/ — данные книг внутри кода. После этапа 4 содержимое
// компендиумов уехало в packs-src/, и восемнадцать библиотек остались в папке
// без единого читателя: 12 416 строк, которые правились наравне с живыми
// (wdbc-ff4.9). Чтобы это не накопилось заново, папка проверяется на достижимость.
//
// Файл считается живым, если до него есть цепочка импортов от кода вне папки:
// module/, tools/, test/ и два файла в корне. Ссылка друг на друга внутри
// module/constants живым файл не делает — так и жила мёртвая половина.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const ROOT  = path.resolve(import.meta.dirname, "..");
const CONST = path.join(ROOT, "module/constants");

/** Все .mjs в папке, рекурсивно. */
const mjsIn = dir => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".mjs"))
  .map(e => path.join(e.parentPath ?? e.path, e.name));

/** Пути, на которые файл ссылается статическим import или import(). */
function importsOf(file) {
  const src = fs.readFileSync(file, "utf8");
  return [...src.matchAll(/from\s+"([^"]+)"|import\(\s*"([^"]+)"/g)]
    .map(m => m[1] || m[2])
    .filter(s => s.startsWith("."))
    .map(s => path.resolve(path.dirname(file), s));
}

describe("module/constants", () => {
  it("у каждого файла есть читатель вне папки", () => {
    const roots = [...mjsIn(path.join(ROOT, "module")), ...mjsIn(path.join(ROOT, "tools")),
                   ...mjsIn(path.join(ROOT, "test")),
                   path.join(ROOT, "warhammer-dbc.mjs"), path.join(ROOT, "critical-tables.mjs")]
      .filter(f => !f.startsWith(CONST));

    const live = new Set();
    const queue = roots.flatMap(importsOf).filter(t => t.startsWith(CONST));
    while (queue.length) {
      const file = queue.pop();
      if (live.has(file)) continue;
      live.add(file);
      queue.push(...importsOf(file).filter(t => t.startsWith(CONST)));
    }

    const orphans = mjsIn(CONST).filter(f => !live.has(f)).map(f => path.relative(CONST, f));
    expect(orphans).toEqual([]);
  });
});
