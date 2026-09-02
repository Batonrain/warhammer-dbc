// test/sheets/armor-aspect-mod.test.mjs
//
// Aspect (wdbc-8b5/wdbc-28ld, стр. 228): «−20 на ВСЕ тесты, пока носишь
// броню без соответствующего Пути». _armorAspectModHtml — метод листа
// персонажа, читает только this.actor — вызывается через .call на голом
// объекте, без Object.create (тот же приём, что и в остальных тестах
// методов ActorSheet, см. doombc-bare-object-actor-test-gotcha в памяти).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";

function armor({ id = "a1", equipped = true, properties = [], propRatings = {} } = {}) {
  return { id, name: `Броня ${id}`, type: "armor", system: { equipped, properties, propRatings } };
}

function sheetFor(items = [], system = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { actor: { items: list, system: { paths: [], ...system } } };
}

describe("_armorAspectModHtml", () => {
  it("нет надетой брони — пустой блок", () => {
    const result = WarhammerCharacterSheet.prototype._armorAspectModHtml.call(sheetFor());
    expect(result.html).toBe("");
    expect(result.mods).toEqual([]);
  });

  it("Aspect без заполненного рейтинга (пустая строка) — не штрафует", () => {
    const sheet = sheetFor([armor({ properties: ["aspect"], propRatings: {} })]);
    const result = WarhammerCharacterSheet.prototype._armorAspectModHtml.call(sheet);
    expect(result.html).toBe("");
  });

  it("Aspect с рейтингом, у персонажа нет нужного Пути — блок с -20", () => {
    const sheet = sheetFor([armor({ properties: ["aspect"], propRatings: { aspect: "Варп-Пауки" } })]);
    const result = WarhammerCharacterSheet.prototype._armorAspectModHtml.call(sheet);
    expect(result.mods).toEqual([{ value: -20, label: "Броня a1" }]);
    expect(result.html).toContain("Варп-Пауки");
    expect(result.html).toContain("-20");
  });

  it("Aspect с рейтингом, у персонажа ЕСТЬ нужный Путь — пустой блок", () => {
    const sheet = sheetFor(
      [armor({ properties: ["aspect"], propRatings: { aspect: "Варп-Пауки" } })],
      { paths: [{ key: "warpspider", grade: "novice" }] }
    );
    const result = WarhammerCharacterSheet.prototype._armorAspectModHtml.call(sheet);
    expect(result.html).toBe("");
  });

  it("снятая (не equipped) броня не участвует", () => {
    const sheet = sheetFor([armor({ properties: ["aspect"], propRatings: { aspect: "Варп-Пауки" }, equipped: false })]);
    const result = WarhammerCharacterSheet.prototype._armorAspectModHtml.call(sheet);
    expect(result.html).toBe("");
  });
});
