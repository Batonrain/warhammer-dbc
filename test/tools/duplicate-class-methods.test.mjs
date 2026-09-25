// test/tools/duplicate-class-methods.test.mjs
//
// Два метода с одним именем в теле класса — не ошибка для JS: второй молча
// перекрывает первый. Так в Мастере создания `_startValues()` Этапа 4 (опыт,
// цена субрасы) был перекрыт одноимённым методом Этапа 2 (Характеристики), и
// Этап 4 начислял 0 опыта всем новым персонажам — ни тест, ни линт этого не
// видели, поймала только живая проверка. Страж: в одном файле метод верхнего
// уровня класса (отступ 2 пробела) не объявляется дважды. get/set/static —
// законные пары, их не считаем.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../module");

function mjsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? mjsFiles(p) : e.name.endsWith(".mjs") ? [p] : [];
  });
}

const METHOD = /^ {2}(?:async\s+)?\*?(#?[A-Za-z_$][\w$]*)\s*\([^)]*\)?[^;=]*\{\s*$/;
const SKIP = new Set(["constructor", "if", "for", "while", "switch", "catch", "function"]);

function duplicateMethods(text) {
  const seenByClass = [];
  let current = null;
  const dups = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^(?:export\s+)?(?:default\s+)?class\s/.test(line)) { current = new Map(); seenByClass.push(current); continue; }
    if (!current || /^ {2}(?:static|get|set)\s/.test(line)) continue;
    const m = METHOD.exec(line);
    if (!m || SKIP.has(m[1])) continue;
    if (current.has(m[1])) dups.push(m[1]);
    current.set(m[1], true);
  }
  return dups;
}

describe("нет одноимённых методов в одном классе", () => {
  it("module/**/*.mjs", () => {
    const offenders = mjsFiles(ROOT).flatMap(f => {
      const d = duplicateMethods(fs.readFileSync(f, "utf8"));
      return d.length ? [`${path.relative(ROOT, f)}: ${d.join(", ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("страж ловит перекрытие (контроль)", () => {
    expect(duplicateMethods("class A {\n  _x() {\n  }\n  _x() {\n  }\n}")).toEqual(["_x"]);
  });
});
