// test/support/v2-sheet-contract.mjs
//
// Общая проверка листа, переведённого на ApplicationV2 (эпик wdbc-ff4.10).
// Рендера в тестах нет — Foundry не запускается, — поэтому проверяется договор
// между классом и шаблоном. Он и ломается тише всего: кнопка с [data-action]
// без обработчика молча ничего не делает, обработчик без кнопки — мёртвый код,
// а разошедшиеся вкладки видно только глазами в игре.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

/**
 * @param {Function} SheetClass  класс листа
 * @param {object}   files       { sheet: "module/...mjs", template: "templates/...hbs" }
 *   template — один файл или список: у листа предмета разметка разложена по
 *   частям на тип предмета, а вкладку Механики собирает строками mechanics.mjs.
 */
export function describeV2Sheet(SheetClass, files) {
  const SOURCE = read(files.sheet);
  const TEMPLATE = [files.template].flat().map(read).join("\n");

  describe(`${SheetClass.name}: перевод на ApplicationV2`, () => {
    // Ищем объявления и вызовы, а не слово: в комментариях V1 упоминается
    // намеренно — там объясняется, какое поведение сохранено.
    it("не осталось html.find, getData и activateListeners", () => {
      const left = [
        [/\bhtml\.find\s*\(/, "html.find"],
        [/^\s*(?:async\s+)?getData\s*\(|\bsuper\.getData\s*\(/m, "getData"],
        [/^\s*(?:async\s+)?activateListeners\s*\(|\bsuper\.activateListeners\s*\(/m, "activateListeners"]
      ].filter(([re]) => re.test(SOURCE)).map(([, name]) => name);
      expect(left).toEqual([]);
    });

    it("не наследуется от appv1", () => {
      expect(SOURCE).not.toContain("foundry.appv1");
    });
  });

  describe(`${SheetClass.name}: шаблон и класс сходятся`, () => {
    const inTemplate = [...new Set([...TEMPLATE.matchAll(/data-action="(\w+)"/g)].map(m => m[1]))];
    const declared = Object.keys(SheetClass.DEFAULT_OPTIONS.actions ?? {});

    it("у каждого data-action есть обработчик", () => {
      expect(inTemplate.filter(a => !declared.includes(a))).toEqual([]);
    });

    it("каждый обработчик кем-то вызывается", () => {
      expect(declared.filter(a => !inTemplate.includes(a))).toEqual([]);
    });

    it("вкладки класса и разметки совпадают", () => {
      const group = SheetClass.TABS?.primary;
      if (!group) return;                       // лист без вкладок — проверять нечего
      // В навигации data-tab подставляется циклом, поэтому сюда попадают только
      // разделы содержимого — их и сверяем со списком вкладок.
      const inMarkup = [...new Set([...TEMPLATE.matchAll(/data-tab="(\w+)"/g)].map(m => m[1]))];
      expect(inMarkup.sort()).toEqual(group.tabs.map(t => t.id).sort());
      expect(group.tabs.map(t => t.id)).toContain(group.initial);
    });

    // Foundry расставляет .active только в changeTab, то есть по клику. При
    // любой другой перерисовке — а submitOnChange перерисовывает лист на каждое
    // изменение поля — класс не возвращается, и раздел, у которого active нет в
    // самой разметке, пропадает с экрана до следующего клика по вкладке. Именно
    // так «ломались» листы Отряда, Формирования и Звёздной системы.
    it("каждый раздел помечает себя active из контекста", () => {
      const group = SheetClass.TABS?.primary;
      if (!group) return;

      const sections = [...TEMPLATE.matchAll(/<div class="tab[^"]*"[^>]*data-tab="(\w+)"[^>]*data-group="primary"/g)];
      const withoutActive = sections
        .filter(m => !/\{\{#if \(eq (\.\.\/)?tab "\w+"\)\}\}active/.test(m[0]))
        .map(m => m[1]);

      expect(withoutActive).toEqual([]);
    });
  });
}
