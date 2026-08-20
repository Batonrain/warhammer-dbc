// test/sheets/item-v2.test.mjs
//
// Лист предмета на ApplicationV2 (wdbc-ff4.10.8). Единственный лист предмета в
// системе и самый плотный по обработчикам: 130 слушателей на 31 тип предмета.
// Общий договор с шаблоном — в describeV2Sheet; здесь своё: что уходит в
// шаблон из _prepareContext.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerItemSheet } from "../../module/sheets/item-sheet.mjs";

// Части перечислены не все — только те, где есть кликабельные элементы: договор
// сверяет действия, а не разметку целиком. Механику собирает строками
// mechanics.mjs, поэтому её кнопки ищутся там же, где и в шаблонах.
describeV2Sheet(WarhammerItemSheet, {
  sheet: "module/sheets/item-sheet.mjs",
  template: [
    "templates/item/item-sheet.hbs",
    "templates/item/parts/armor.hbs",
    "templates/item/parts/component.hbs",
    "templates/item/parts/gear.hbs",
    "templates/item/parts/infoguard.hbs",
    "templates/item/parts/psychic-power.hbs",
    "templates/item/parts/ritual.hbs",
    "templates/item/parts/talent.hbs",
    "templates/item/parts/tech-power.hbs",
    "templates/item/parts/torpedo.hbs",
    "templates/item/parts/weapon.hbs",
    "module/apps/mechanics.mjs"
  ]
});

function item(type, system = {}) {
  return {
    id: "i1", name: "Болтер", type, img: "b.png", uuid: `Item.${type}`,
    isOwner: true,
    system: { description: "", ...system },
    effects: { contents: [], get: () => null, filter: () => [] },
    getFlag: () => null,
    parent: null
  };
}

function sheetLike(doc, extra = {}) {
  return Object.assign(Object.create(WarhammerItemSheet.prototype),
    { item: doc, document: doc, isEditable: true, tabGroups: { "item-primary": "info" } }, extra);
}

const ctxOf = doc => WarhammerItemSheet.prototype._prepareContext.call(sheetLike(doc), {});

beforeEach(() => { globalThis.game.user.isGM = true; });

describe("_prepareContext", () => {
  it("вкладка по умолчанию — ИНФО, предмет уходит в шаблон", async () => {
    const doc = item("gear");
    const ctx = await ctxOf(doc);

    expect(ctx.tab).toBe("info");
    expect(ctx.item).toBe(doc);
    expect(ctx.system).toBe(doc.system);
  });

  // Строки, а не числа: шаблон сравнивает значение селекта через eq, и 0 !== "0".
  it("доступность и баланс приводятся к строке для сравнения в шаблоне", async () => {
    const ctx = await ctxOf(item("gear", { availability: 0, balance: -10 }));

    expect(ctx.system.availabilityStr).toBe("0");
    expect(ctx.system.balanceStr).toBe("-10");
  });

  it("у оружия активные свойства отделены от доступных к добавлению", async () => {
    const ctx = await ctxOf(item("weapon", { weaponProps: [{ key: "tainted", rating: 2 }] }));

    expect(ctx.weaponPropsActive.map(p => p.key)).toEqual(["tainted"]);
    expect(ctx.weaponPropsAvailable.some(d => d.key === "tainted")).toBe(false);
    expect(ctx.weaponPropsAvailable.length).toBeGreaterThan(0);
  });

  it("неизвестное свойство в данных не попадает на лист", async () => {
    // def берётся из справочника: у выдуманного ключа его нет, и строка без
    // определения отрисовалась бы пустой.
    const ctx = await ctxOf(item("weapon", { weaponProps: [{ key: "нет-такого" }] }));

    expect(ctx.weaponPropsActive).toEqual([]);
  });
});

// Часть на тип предмета лист подключает сам — по `{{#if (eq item.type …)}}`.
// Партиал, который предзагружен, но никуда не вставлен, ничего не ломает и
// молчит: на листе просто нет целого раздела. Так пропали иерархия Фракции и
// поле «Входит в состав» — их часть выпала при слиянии веток, а предзагрузка
// осталась, и потерю никто не заметил.
describe("части листа предмета подключены, а не только предзагружены", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const read = p => fs.readFileSync(path.join(root, p), "utf8");

  it("каждая предзагруженная часть предмета встречается в разметке", () => {
    const main = read("warhammer-dbc.mjs");
    const sheet = read("templates/item/item-sheet.hbs");

    const preloaded = [...main.matchAll(/"systems\/warhammer-dbc\/(templates\/item\/parts\/[\w-]+\.hbs)"/g)]
      .map(m => m[1]);
    // Части, которые вставляет не лист, а другая часть — ищем и в них.
    const partials = preloaded.map(p => read(p)).join("\n");

    const unused = [...new Set(preloaded)]
      .filter(p => !sheet.includes(p) && !partials.includes(p));

    expect(unused).toEqual([]);
  });
});
