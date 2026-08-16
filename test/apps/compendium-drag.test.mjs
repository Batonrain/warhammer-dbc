// test/apps/compendium-drag.test.mjs
//
// Перетаскивание записи из Обозревателя наружу. Foundry читает из payload род
// документа: «Item» кладётся на лист, «Actor» — на сцену и в боковую панель.
// Род брался жёстко «Item», и актор, перетащенный на карту, молча не появлялся.
//
// Рендера здесь нет — проверяется разметка записи и то, что обработчик берёт
// род из неё, а не из константы.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../module/apps/compendium-browser.mjs"), "utf8");

describe("драг-н-дроп из Обозревателя", () => {
  it("запись несёт род документа своего пака", () => {
    expect(SOURCE).toContain('doc: pack.metadata?.type || "Item"');
    expect(SOURCE).toContain('data-doc="${esc(it.doc || "Item")}"');
  });

  it("payload берёт род из записи, а не из константы", () => {
    expect(SOURCE).toContain('type: el.dataset.doc || "Item"');
    // Прежняя жёсткая строка не должна вернуться незамеченной.
    expect(SOURCE).not.toContain('JSON.stringify({ type: "Item", uuid: el.dataset.uuid })');
  });
});
