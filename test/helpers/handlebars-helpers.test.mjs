// test/helpers/handlebars-helpers.test.mjs
//
// wdbc-ye6 (пункт 2): не было теста, ловящего рассинхрон между
// module/helpers/handlebars.mjs и реальным использованием хелперов в
// templates/**/*.hbs. Два класса бага, которые раньше ничем не ловились:
//
//   1. Шаблон зовёт `{{someHelper x}}`/`(someHelper x)`, а хелпер с таким
//      именем нигде не зарегистрирован — Handlebars бросает "Missing helper"
//      при рендере, и это видно только глазами в игре, а не в тестах.
//   2. Хелпер зарегистрирован в handlebars.mjs, но ни один шаблон его не
//      зовёт — мёртвый код, который никто не заметит при рефакторинге.
//
// Рендера здесь нет (Foundry в тестах не запускается) — поэтому вызов хелпера
// ищется текстом: как подвыражение `(name арг ...)` или как прямой вызов
// `{{name арг ...}}`/`{{{name арг ...}}}` — оба случая требуют хотя бы один
// аргумент после имени, иначе `{{name}}` неотличимо от простого поля
// контекста (см. test/templates/template-fields-computed.test.mjs — тот тест
// про поля, этот — про хелперы, они дополняют друг друга, не дублируют).
//
// Комментарии `{{!-- ... --}}`/`{{! ... }}` вычищаются до разбора: русский
// текст комментария нередко содержит скобки или "слово аргумент" и даёт
// ложные совпадения (см. журнал сессии wdbc-ye6, находка на "checked",
// "nextThreshold" и т.п. — все были внутри комментариев).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HANDLEBARS_MJS = path.join(ROOT, "module/helpers/handlebars.mjs");
const TEMPLATES = path.join(ROOT, "templates");

function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Имена, зарегистрированные через Handlebars.registerHelper("имя", ...). */
function registeredHelperNames() {
  const src = fs.readFileSync(HANDLEBARS_MJS, "utf8");
  return [...src.matchAll(/registerHelper\(\s*["']([\w]+)["']/g)].map(m => m[1]);
}

// Хелперы, которые регистрирует само ядро Foundry (foundry.applications.
// handlebars.HandlebarsHelpers) или сам Handlebars — их не ищем в
// module/helpers/handlebars.mjs, они не наш код.
const FOUNDRY_AND_HANDLEBARS_BUILTINS = new Set([
  "if", "unless", "each", "with", "else", "lookup", "log",
  "localize", "numberFormat", "timeSince",
  "formInput", "formGroup", "formField",
  "editor", "filePicker", "colorPicker", "rangePicker", "selectOptions",
  "checked", "disabled", "selected"
]);

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";
const SUBEXPR_RE = new RegExp(`\\(\\s*(${IDENT})\\s+`, "g");
const DIRECT_RE = new RegExp(`^(${IDENT})\\s+\\S`);
const COMMENT_RE = /\{\{!--[\s\S]*?--\}\}|\{\{![^}]*\}\}/g;
const TAG_RE = /\{\{\{?[^}]+\}\}\}?/g;

/** Имена, вызванные как хелпер (с хотя бы одним аргументом) в одном .hbs. */
function helperCallsIn(src) {
  const stripped = src.replace(COMMENT_RE, m => " ".repeat(m.length));
  const found = new Set();
  for (const raw of stripped.match(TAG_RE) ?? []) {
    for (const m of raw.matchAll(SUBEXPR_RE)) found.add(m[1]);
    const inner = raw.replace(/^\{\{\{?#?\/?/, "").replace(/\}\}\}?$/, "");
    const first = inner.match(DIRECT_RE);
    if (first) found.add(first[1]);
  }
  return found;
}

describe("Handlebars-хелперы: регистрация и templates/**/*.hbs сходятся", () => {
  const registered = registeredHelperNames();
  const hbsFiles = walk(TEMPLATES, ".hbs");

  it("нашлось больше нуля зарегистрированных хелперов (страж не выключен пустым списком)", () => {
    expect(registered.length).toBeGreaterThan(0);
  });

  it("нашлось больше нуля файлов шаблонов (страж не выключен пустым списком)", () => {
    expect(hbsFiles.length).toBeGreaterThan(0);
  });

  const usage = new Map(); // имя -> [файлы, где вызван]
  for (const f of hbsFiles) {
    const src = fs.readFileSync(f, "utf8");
    for (const name of helperCallsIn(src)) {
      if (!usage.has(name)) usage.set(name, []);
      usage.get(name).push(path.relative(ROOT, f));
    }
  }

  it("каждый вызов вида (имя арг)/{{имя арг}} в шаблоне — либо зарегистрированный хелпер, либо встроенный в Foundry/Handlebars", () => {
    const unknown = [...usage.keys()].filter(
      name => !registered.includes(name) && !FOUNDRY_AND_HANDLEBARS_BUILTINS.has(name)
    );
    expect(unknown).toEqual([]);
  });

  it("каждый зарегистрированный хелпер реально вызывается хотя бы в одном шаблоне", () => {
    const dead = registered.filter(name => !usage.has(name));
    expect(dead).toEqual([]);
  });
});
