// test/templates/tab-active-class.test.mjs
//
// Каждая вкладка листа обязана сама помечать себя активной по контексту `tab`.
//
// Найдено на живом листе: у вкладки КРАФТ этого не было, и любая её кнопка
// (все они зовут sheet.render) заставляла содержимое исчезнуть — функция
// срабатывала, но вкладка возвращалась пустой, пока её не откроешь заново.
// Причина не в обработчиках, а в разметке: после ре-рендера класс `active`
// проставляет сам шаблон, и вкладка без этой строки остаётся скрытой.
//
// Тест смотрит на РАЗМЕТКУ, а не на поведение конкретной кнопки: иначе
// следующая добавленная вкладка отвалится ровно так же и молча.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const ROOT  = path.resolve(import.meta.dirname, "../..");
const PARTS = path.join(ROOT, "templates/actor/parts");

/** Корневой <div class="tab ..."> файла вкладки, если он там есть. */
function rootTabDiv(file) {
  const html = fs.readFileSync(path.join(PARTS, file), "utf8");
  const m = html.match(/<div class="tab [^"]*"[^>]*data-tab="([^"]+)"/);
  return m ? { tag: m[0], key: m[1] } : null;
}

const tabFiles = fs.readdirSync(PARTS).filter(f => f.startsWith("tab-") && f.endsWith(".hbs"));

describe("вкладки листа актора помечают себя активными", () => {
  it("файлы вкладок вообще найдены", () => {
    expect(tabFiles.length).toBeGreaterThan(5);
  });

  for (const file of tabFiles) {
    const root = rootTabDiv(file);
    if (!root) continue; // tab-nav.hbs и подобные — не сама вкладка, а её оснастка

    it(`${file}: класс active ставится по своему ключу «${root.key}»`, () => {
      // Ровно то, что делают все остальные вкладки:
      //   {{#if (eq tab "<ключ>")}}active{{/if}}
      expect(root.tag).toContain("active");
      expect(root.tag).toContain(`(eq tab "${root.key}")`);
    });
  }
});
