// test/sheets/item-v2.test.mjs
//
// Лист предмета на ApplicationV2 (wdbc-ff4.10.8). Единственный лист предмета в
// системе и самый плотный по обработчикам: 130 слушателей на 31 тип предмета.
// Общий договор с шаблоном — в describeV2Sheet; здесь своё: что уходит в
// шаблон из _prepareContext.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerItemSheet } from "../../module/sheets/item-sheet.mjs";

describeV2Sheet(WarhammerItemSheet, {
  sheet: "module/sheets/item-sheet.mjs",
  template: "templates/item/item-sheet.hbs"
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
