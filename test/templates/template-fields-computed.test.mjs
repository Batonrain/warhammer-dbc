// test/templates/template-fields-computed.test.mjs
//
// Обобщение test/templates/book-source-row.test.mjs (wdbc-fl3) на весь
// templates/**/*.hbs. Тот тест ловил рассинхрон схема↔лист для одного
// конкретного поля; этот — более широкий и дешёвый класс того же семейства
// багов (wdbc-o80l): партиал прятал AP/charBonuses-поля за
// {{#if effectsMigrated}}, но флаг effectsMigrated нигде в module/ не
// вычислялся — Handlebars всегда падал в else, и лист молча показывал не то,
// что должен был. Ссылка на несуществующее вычисляемое поле не бросает
// исключение (Handlebars трактует undefined как falsy), поэтому такой баг не
// шумит нигде, кроме "лист выглядит неправильно" — находка занимает дни.
//
// Проверяется только ВЕРХНЕУРОВНЕВОЕ {{#if ИМЯ}}/{{unless ИМЯ}}/{{ИМЯ}} —
// простой идентификатор без точки, без аргументов, без @-переменных
// Handlebars — вне тела {{#each}}/{{#with}} (там бэйр-имя это поле элемента
// цикла/поддерева данных, а не вычисленный контекст листа, и вообще не
// обязано существовать в module/). Каждое найденное имя обязано хотя бы
// текстом встречаться в каком-нибудь module/**/*.mjs — иначе взять его
// неоткуда, и в шаблоне оно "ИМЯ, которое никто не вычисляет".

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const ROOT      = path.resolve(import.meta.dirname, "../..");
const TEMPLATES = path.join(ROOT, "templates");
const MODULE    = path.join(ROOT, "module");

function walk(dir, ext) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// Встроенные ключевые слова блоков и зарегистрированные хелперы — не имена
// вычисляемых полей контекста, исключаются из проверки, даже если встретятся
// бэйр-тегом.
const NOT_A_FIELD = new Set([
  "this", "else",
  "techIcon", "veilIcon", "ammoHasType", "codeIncludes", "eq", "grantMark",
  "eqLoose", "lt", "gt", "gte", "lte", "multiply", "divCeil", "poisonHasVector",
  "and", "or", "not", "signedNum", "join"
]);

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";
const TAG_RE = /\{\{\{?[^}]+\}\}\}?/g;

/** Верхнеуровневые {{#if ИМЯ}}/{{#unless ИМЯ}}/{{ИМЯ}} одного .hbs файла. */
function topLevelFieldRefs(src) {
  const found = new Set();
  let scopedDepth = 0;
  for (const raw of src.match(TAG_RE) ?? []) {
    const tag = raw.replace(/^\{\{\{?/, "").replace(/\}\}\}?$/, "").trim();

    if (/^#(each|with)\b/.test(tag)) { scopedDepth++; continue; }
    if (/^\/(each|with)\b/.test(tag)) { scopedDepth = Math.max(0, scopedDepth - 1); continue; }
    if (scopedDepth > 0) continue;

    let m;
    if ((m = tag.match(new RegExp(`^#(?:if|unless)\\s+(${IDENT})$`)))) {
      found.add(m[1]);
    } else if ((m = tag.match(new RegExp(`^(${IDENT})$`)))) {
      if (!NOT_A_FIELD.has(m[1])) found.add(m[1]);
    }
  }
  return found;
}

describe("templates/**/*.hbs: верхнеуровневые поля вычисляются в module/", () => {
  const hbsFiles = walk(TEMPLATES, ".hbs");
  const mjsFiles = walk(MODULE, ".mjs");
  const mjsSources = mjsFiles.map(f => fs.readFileSync(f, "utf8")).join("\n");

  it("нашлось больше нуля файлов шаблонов (страж не выключен пустым списком)", () => {
    expect(hbsFiles.length).toBeGreaterThan(0);
  });

  it("каждое верхнеуровневое {{#if ИМЯ}}/{{ИМЯ}} хотя бы текстом встречается в module/**/*.mjs", () => {
    const offenders = [];
    for (const f of hbsFiles) {
      const src = fs.readFileSync(f, "utf8");
      for (const name of topLevelFieldRefs(src)) {
        if (!new RegExp(`\\b${name}\\b`).test(mjsSources)) {
          offenders.push(`${path.relative(ROOT, f)}: {{${name}}} нигде не вычисляется в module/`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
