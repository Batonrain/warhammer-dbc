// test/sheets/ritual-row.test.mjs
//
// Строка ритуала на вкладке МИСТИКА (переехала со СПОСОБНОСТЕЙ, wdbc-5qk
// изначально, перенос — отдельная правка). Раздел нёс свой клик по имени,
// свою кнопку «✕» и лишнюю колонку под неё — за поведение, которое у таблиц
// Талантов и Черт уже даёт общее контекстное меню строки предмета
// (activateItemContextMenu вешается на всякую .item-row).
//
// Кнопка «＋» остаётся: контекстное меню умеет открывать и удалять, но не
// добавлять.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { activateRitualListeners } from "../../module/sheets/tabs/rituals.mjs";

const hbs = fs.readFileSync(path.resolve(import.meta.dirname,
  "../../templates/actor/parts/tab-psy.hbs"), "utf8");

/** Разметка таблицы ритуалов — от её панели до конца таблицы. */
const ritualsTable = hbs.slice(hbs.indexOf("rituals-table"), hbs.indexOf("</table>", hbs.indexOf("rituals-table")));

/** Подставной html: запоминает, на какие селекторы навесили обработчики. */
function fakeHtml() {
  const bound = [];
  return { bound, find: sel => ({ on: () => bound.push(sel) }) };
}

describe("строка ритуала", () => {

  it("это обычная .item-row с id предмета — её подхватит контекстное меню", () => {
    expect(ritualsTable).toContain('class="item-row');
    expect(ritualsTable).toContain('data-item-id="{{r.id}}"');
  });

  it("своих кнопок и колонки под них в строке нет", () => {
    for (const dead of ["ritual-remove-btn", "ritual-row-actions", "ritual-name-link"])
      expect(ritualsTable, `${dead} осталась в разметке`).not.toContain(dead);
  });

  it("раздел вешает только «＋», остальное — общему меню", () => {
    const html = fakeHtml();
    activateRitualListeners(html, { items: [] });

    expect(html.bound).toEqual([".ritual-add-btn"]);
  });

  it("мёртвых правил в стилях не осталось", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname,
      "../../styles/sheets/actor-effects.css"), "utf8");

    for (const dead of ["ritual-remove-btn", "ritual-row-actions", "ritual-name-link"])
      expect(css, `${dead} осталась в стилях`).not.toContain(dead);
  });
});
