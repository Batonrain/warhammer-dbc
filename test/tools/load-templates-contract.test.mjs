// test/tools/load-templates-contract.test.mjs
//
// Handlebars разворачивает партиал {{> "systems/..."}} только если путь
// зарегистрирован через loadTemplates — незарегистрированный роняет рендер
// листа целиком. Список в warhammer-dbc.mjs ведётся руками, и это уже дважды
// стреляло (toggle-rows.hbs — листы Герольдов, ship-hull.hbs — лист Корпуса):
// вложенный партиал под {{#if}} не разворачивается на большинстве акторов,
// и зелёные тесты рендера ничего не гарантируют. Контракт: каждый партиал,
// на который ссылается любой шаблон, есть в списке предзагрузки.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../tools/packs.mjs";

const hbsFiles = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return hbsFiles(p);
  return name.endsWith(".hbs") ? [p] : [];
});

describe("контракт предзагрузки шаблонов", () => {
  const main = readFileSync(join(ROOT, "warhammer-dbc.mjs"), "utf8");
  const preloaded = new Set([...main.matchAll(/"(systems\/warhammer-dbc\/templates\/[^"]+\.hbs)"/g)].map(m => m[1]));

  it("каждый {{> путь}} из templates/ зарегистрирован в loadTemplates", () => {
    const missing = [];
    for (const file of hbsFiles(join(ROOT, "templates"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\{\{>\s*"(systems\/warhammer-dbc\/templates\/[^"]+\.hbs)"/g)) {
        if (!preloaded.has(m[1])) missing.push(`${file.slice(ROOT.length + 1)} → ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
