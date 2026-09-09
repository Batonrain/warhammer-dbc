// test/templates/block-param-depth.test.mjs
//
// Блок-параметр (`{{#each xs as |x|}}`) читается по имени во всех вложенных
// блоках, и НИКОГДА через `../`: в Handlebars `../` поднимается по контексту,
// а не по блок-параметрам (компилятор считает путь блок-параметром только при
// depth === 0). Поэтому `../x.foo` внутри вложенного each — это поиск свойства
// `x` у родительского контекста, то есть всегда undefined.
//
// Проверено вживую на handlebars 4.7.7:
//   {{#each cats as |c|}}{{#each c.steps as |s|}}{{#if (eq s.value ../c.chosen)}}
//   → подсветки нет никогда;  без `../` → есть.
//
// Так сломались оба выпадающих списка окна «Итоги Сессии» (wdbc-b5f): ГМ
// выбирал опыт, а список тут же показывал первый пункт. Тестами это не ловилось
// — их у шаблона не было вовсе, а зелёными оставались обе половины порознь.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

/** Все .hbs проекта. */
function templates(dir = path.join(root, "templates")) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? templates(p) : (e.name.endsWith(".hbs") ? [p] : []);
  });
}

/** Имена блок-параметров файла: `as |a b|` → ["a", "b"]. */
function blockParams(src) {
  return [...src.matchAll(/\bas\s*\|([^|]+)\|/g)]
    .flatMap(m => m[1].trim().split(/\s+/));
}

describe("блок-параметры шаблонов не читаются через ../", () => {
  it("ни один .hbs не поднимается к блок-параметру по контексту", () => {
    const bad = [];
    for (const file of templates()) {
      const src   = fs.readFileSync(file, "utf8");
      const names = blockParams(src);
      if (!names.length) continue;
      for (const name of new Set(names)) {
        // `../name` и `../../name` — с точкой (свойство) или как есть.
        const re = new RegExp(`(?:\\.\\./)+${name}\\b`, "g");
        for (const m of src.matchAll(re)) {
          const line = src.slice(0, m.index).split("\n").length;
          bad.push(`${path.relative(root, file)}:${line} → ${m[0]}`);
        }
      }
    }
    expect(bad, "путь всегда даёт undefined — писать имя блок-параметра без ../").toEqual([]);
  });
});
