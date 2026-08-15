// test/templates/book-source-row.test.mjs
//
// «Книга-источник» на листе предмета (wdbc-fl3). Поле system.bookSource было
// объявлено в схемах и заполнено в паках, а строки ввода на листе не было:
// у Снаряжения (оно же Инструменты и Кибернетика — все три рисуются gear.hbs)
// и у Импланта. Значение из пака лежало в предмете и было недостижимо.
//
// Проверяется не «эти три файла поправлены», а связь схемы и листа в обе
// стороны — иначе следующий тип предмета отвалится ровно так же:
//
//   поле в схеме есть → на листе должна быть строка ввода;
//   строка ввода есть → поле должно быть в схеме, иначе ввод пишет в никуда
//   (Foundry молча выбросит значение, которого нет в defineSchema).
//
// Типы без своей части листа (homeworld, divination) в проверку не входят:
// показывать поле негде, потому что листа у них нет вовсе.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { ITEM_DATA_MODELS } from "../../module/data/index.mjs";

const root = path.resolve(import.meta.dirname, "../..");

/** Тип предмета → файл части листа, по диспетчеру item-sheet.hbs. */
function sheetParts() {
  const hbs = fs.readFileSync(path.join(root, "templates/item/item-sheet.hbs"), "utf8");
  // {{#if (eq item.type "gear")}} … {{> "…/parts/gear.hbs"}}
  const re = /\(eq item\.type "(\w+)"\)\}\}\s*\{\{>\s*"[^"]*\/parts\/([\w-]+\.hbs)"/g;
  return new Map([...hbs.matchAll(re)].map(m => [m[1], m[2]]));
}

const PARTS = sheetParts();

/** Есть ли у схемы типа поле bookSource. */
const schemaHasField = type =>
  Object.hasOwn(new ITEM_DATA_MODELS[type]({}).toObject(), "bookSource");

/** Есть ли в части листа ввод книги-источника. */
const partHasInput = file =>
  fs.readFileSync(path.join(root, "templates/item/parts", file), "utf8")
    .includes('name="system.bookSource"');

describe("книга-источник на листе предмета", () => {

  it("диспетчер листа разобран", () => {
    // Регулярка ломается молча: пустая карта прошла бы обе проверки ниже.
    expect(PARTS.get("gear")).toBe("gear.hbs");
    expect(PARTS.get("tool")).toBe("gear.hbs");
    expect(PARTS.size).toBeGreaterThan(20);
  });

  it("у каждого типа с полем в схеме есть строка на листе", () => {
    const missing = [...PARTS].filter(([type, file]) =>
      ITEM_DATA_MODELS[type] && schemaHasField(type) && !partHasInput(file));

    expect(missing.map(([t, f]) => `${t} → ${f}`)).toEqual([]);
  });

  it("у каждого типа со строкой на листе есть поле в схеме", () => {
    const orphan = [...PARTS].filter(([type, file]) =>
      ITEM_DATA_MODELS[type] && partHasInput(file) && !schemaHasField(type));

    expect(orphan.map(([t, f]) => `${t} → ${f}`)).toEqual([]);
  });
});
