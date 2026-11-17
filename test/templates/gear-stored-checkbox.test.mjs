// test/templates/gear-stored-checkbox.test.mjs
//
// «Хранится не при себе» (wdbc-6rj, system.stored): чекбокс .item-stored-cb
// стоял у оружия, брони, боеприпасов, снаряжения, препаратов и инструментов, но
// не у таблицы Силовых полей и не у строк установленных модов оружия/брони —
// хотя схема и расчёт Нагрузки (rules/character.mjs) работают для всех типов
// сразу. Без чекбокса отметить такой предмет можно было только правкой данных
// актора (task-f894).
//
// Handlebars в devDependencies нет, поэтому шаблон проверяется как текст (так
// же устроены соседние тесты test/templates/), а данные для него — настоящим
// контекстом листа (buildGetData).

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";

const SRC = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../templates/actor/parts/tab-gear.hbs"), "utf8");

/** Секция вкладки по data-cat (от открывающего <section> до закрывающего). */
function section(cat) {
  const start = SRC.indexOf(`<section class="gear-cat {{#if gearCollapse.${cat}}}collapsed{{/if}}" data-cat="${cat}">`);
  expect(start, `секция ${cat} найдена`).toBeGreaterThan(-1);
  return SRC.slice(start, SRC.indexOf("</section>", start));
}

/** Все <tr …> строки-моды (gear-modsub-row) секции: [{open, html}] */
function modRows(sec) {
  return [...sec.matchAll(/<tr class="item-row gear-modsub-row[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => ({ open: m[0].slice(0, m[0].indexOf(">") + 1), html: m[1] }));
}

/** Сумма colspan ячеек строки (ячейка без colspan = 1). */
function columnsOf(rowHtml) {
  return [...rowHtml.matchAll(/<td\b([^>]*)>/g)]
    .reduce((n, m) => n + (parseInt(m[1].match(/colspan="(\d+)"/)?.[1] ?? "1") || 1), 0);
}

/** Число столбцов заголовка первой таблицы секции. */
function headerColumns(sec) {
  const thead = sec.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  return [...thead.matchAll(/<th\b/g)].length;
}

const STORED_CB = /<input type="checkbox" class="item-stored-cb" data-item-id="\{\{(\w+)\.id\}\}"[^>]*\{\{#if \1\.stored\}\}checked\{\{\/if\}\}\/>/;

describe("Силовые поля: чекбокс «Хранится»", () => {
  const sec = section("shields");

  it("в заголовке есть столбец «Хран.»", () => {
    expect(sec).toContain('<th class="gear-stored-th"');
  });

  it("в строке поля стоит .item-stored-cb с id поля и отметкой от f.stored", () => {
    const row = sec.match(/<tr class="item-row shield-row[\s\S]*?<\/tr>/)[0];
    const m = row.match(STORED_CB);
    expect(m, "чекбокс по образцу соседних таблиц").not.toBeNull();
    expect(m[1]).toBe("f");
  });

  it("число ячеек строки и пустой строки совпадает с заголовком", () => {
    const row = sec.match(/<tr class="item-row shield-row[\s\S]*?<\/tr>/)[0];
    expect(columnsOf(row)).toBe(headerColumns(sec));
    const empty = sec.match(/<tr class="items-empty">([\s\S]*?)<\/tr>/)[1];
    expect(columnsOf(empty)).toBe(headerColumns(sec));
  });
});

describe.each([["weapons", 6], ["armor", 8]])("Под-строки установленных модов: %s", (cat, mainSpan) => {
  const sec = section(cat);
  const rows = modRows(sec);

  it("строка мода есть", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("в каждой строке мода стоит .item-stored-cb с id мода и отметкой от m.stored", () => {
    for (const r of rows) {
      const m = r.html.match(STORED_CB);
      expect(m, "чекбокс в строке мода").not.toBeNull();
      expect(m[1]).toBe("m");
    }
  });

  it("чекбокс стоит под столбцом «Хран.» хоста — сразу после стрелки ↳", () => {
    for (const r of rows) {
      expect(r.html.indexOf("gear-modsub-arrow")).toBeLessThan(r.html.indexOf("item-stored-cb"));
      expect(r.html.indexOf("item-stored-cb")).toBeLessThan(r.html.indexOf("gear-modsub-main"));
      expect(r.html).toContain(`gear-modsub-main" colspan="${mainSpan}"`);
    }
  });

  it("строка мода занимает ровно столько столбцов, сколько таблица хоста", () => {
    // До правки не хватало одного: таблица получила «Хран.», строка мода — нет.
    for (const r of rows) expect(columnsOf(r.html)).toBe(headerColumns(sec));
  });
});

describe("Контекст листа отдаёт stored для модов и силовых полей", () => {
  const ctxOf = items => {
    const sheet = sheetOf(WarhammerCharacterSheet, { items, characteristics: {}, skills: {}, groupSkills: {} });
    sheet.actor.items.contents = sheet.actor.items;
    return buildGetData(sheet.actor);
  };
  const item = (id, type, system = {}) => ({ id, name: id, type, system, getFlag: () => undefined });

  it("мод оружия и мод брони: stored из system.stored", () => {
    const ctx = ctxOf([
      item("w1", "weapon", { weaponClass: "basic", weaponType: "bolt" }),
      item("wm1", "weaponMod", { installedOn: "w1", stored: true }),
      item("wm2", "weaponMod", { installedOn: "w1" }),
      item("a1", "armor", { armorType: "flak" }),
      item("am1", "armorMod", { installedOn: "a1", stored: true }),
      item("am2", "armorMod", { installedOn: "a1" })
    ]);
    const wMods = ctx.gearWeapons.find(w => w.id === "w1").mods;
    expect(wMods.find(m => m.id === "wm1").stored).toBe(true);
    expect(wMods.find(m => m.id === "wm2").stored).toBe(false);
    const aMods = ctx.gearArmor.find(a => a.id === "a1").mods;
    expect(aMods.find(m => m.id === "am1").stored).toBe(true);
    expect(aMods.find(m => m.id === "am2").stored).toBe(false);
  });

  it("силовое поле: stored из system.stored", () => {
    const ctx = ctxOf([
      item("f1", "forcefield", { stored: true }),
      item("f2", "forcefield", {})
    ]);
    expect(ctx.gearForcefields.find(f => f.id === "f1").stored).toBe(true);
    expect(ctx.gearForcefields.find(f => f.id === "f2").stored).toBe(false);
  });
});
