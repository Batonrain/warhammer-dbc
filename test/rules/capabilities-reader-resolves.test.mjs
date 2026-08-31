// test/rules/capabilities-reader-resolves.test.mjs
//
// module/constants/capabilities.mjs — реестр имён Возможностей; поле `reader`
// у каждой записи — свободный текст, куда автор вписывает путь+функцию, где
// имя реально читается. Текст никто не проверяет: путь может протухнуть при
// переименовании файла, функция — при рефакторинге, и реестр начнёт молча
// врать (тот же класс бага, что и сгнившая шапка-комментарий — см.
// [[doombc-mechanics-registry-sweep]]). Тест разбирает `reader` двумя
// узнаваемыми паттернами — `module/**.mjs funcName()` и
// `module/**.mjs::funcName` — и проверяет, что путь существует, а имя
// функции/метода хотя бы упоминается в файле как текст (не полноценный
// AST-анализ, но ловит опечатку/удаление вернее, чем ничего).

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

const PATH_RE = /module\/[\w-]+(?:\/[\w-]+)*\.mjs/g;
const FUNC_ADJACENT_RE = /(module\/[\w-]+(?:\/[\w-]+)*\.mjs)\s+([A-Za-z_$][\w$]*)\(\)/g;
const METHOD_COLON_RE  = /(module\/[\w-]+(?:\/[\w-]+)*\.mjs)::([A-Za-z_$][\w$]*)/g;

describe("реестр Возможностей: reader резолвится", () => {
  const readers = Object.entries(CAPABILITIES)
    .filter(([, def]) => def.reader);

  it("непустых reader в реестре нашлось больше нуля (страж не выключен пустым результатом)", () => {
    expect(readers.length).toBeGreaterThan(0);
  });

  it("каждый путь module/**.mjs, упомянутый в reader, существует", () => {
    const offenders = [];
    for (const [key, def] of readers) {
      for (const p of def.reader.match(PATH_RE) ?? []) {
        if (!fs.existsSync(path.join(ROOT, p))) offenders.push(`${key}: путь не найден — ${p}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("каждая функция/метод, названные рядом с путём в reader, упоминаются в этом файле", () => {
    const offenders = [];
    for (const [key, def] of readers) {
      const pairs = [...def.reader.matchAll(FUNC_ADJACENT_RE), ...def.reader.matchAll(METHOD_COLON_RE)];
      for (const [, p, symbol] of pairs) {
        const abs = path.join(ROOT, p);
        if (!fs.existsSync(abs)) continue; // уже отдельный offender выше
        const src = fs.readFileSync(abs, "utf8");
        if (!new RegExp(`\\b${symbol}\\b`).test(src)) {
          offenders.push(`${key}: "${symbol}" не найден текстом в ${p}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
