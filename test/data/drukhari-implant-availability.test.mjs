// test/data/drukhari-implant-availability.test.mjs
//
// wdbc-zaesd (23.10.2026), часть «Друкхари»: у 39 биоимплантов Друкхари (Бичеватель,
// Гемункульские, Ферментный Чан) system.availability не было, хотя Книга Аэльдари:
// Ответвления («БИОИМПЛАНТЫ», стр. 149) даёт Редкость каждому, а значение уже
// стояло в начале описания («R 3. …»). Без поля они не попадали ни под фильтр
// Редкости в Обозревателе, ни под потолок закупки в магазине снаряжения.
//
// Сторож: у КАЖДОГО импланта Друкхари Редкость в поле совпадает с префиксом «R N»
// описания. Регулярка без \w/\b (кириллица, AGENTS.md → «Кириллица в регулярках»).

import { describe, it, expect } from "vitest";
import { packDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const DRUKHARI_DIR = "Биоимпланты__Друкхари_";
// Два книжных вида префикса: «R 3. …» (Бичеватель, Чан) и «<p><strong>R: 4</strong>…»
// (Гемункульские, Необычные) — теги срезаются до разбора.
const PREFIX_RE = /^\s*R:? ?(\d)(?![0-9])/;
const PREFIX = { exec: s => PREFIX_RE.exec(String(s).replace(/<[^>]*>/g, "")), test: s => PREFIX.exec(s) !== null };

const drukhari = () =>
  packDocuments("implants", "implant").filter(({ file }) => file.split(/[\\/]/).includes(DRUKHARI_DIR));

describe("Биоимпланты Друкхари: Редкость в поле совпадает с книжным префиксом описания", () => {
  it("все импланты Друкхари несут префикс «R N» в описании", () => {
    const docs = drukhari();
    expect(docs.length).toBeGreaterThan(100);
    const without = docs.filter(({ doc }) => !PREFIX.test(doc.system?.description ?? "")).map(d => d.file);
    expect(without).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("system.availability заполнено и равно N из префикса", () => {
    const bad = [];
    for (const { file, doc } of drukhari()) {
      const m = PREFIX.exec(doc.system?.description ?? "");
      if (!m) continue;
      if (doc.system.availability !== Number(m[1])) bad.push(`${doc.name}: поле=${doc.system.availability}, книга=R${m[1]}`);
    }
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("папки, где поля не было (39 имплантов), покрыты целиком", () => {
    // Клюв 5, Конечности и Голова 7, Крылья 9, Основные 3, Перья 6, Гемункульские
    // (8 из 15), Ферментный Чан 1 = 39.
    const targeted = ["Бичеватель___", "Гемункульские", "Ферментный_Чан"];
    const docs = drukhari().filter(({ file }) => targeted.some(t => file.includes(t)));
    const filled = docs.filter(({ doc }) => Number.isInteger(doc.system.availability));
    expect(filled.length).toBe(docs.length);
    expect(docs.length).toBe(46); // 5+7+9+3+6 Бичеватель, 15 Гемункульские (7 уже были с полем), 1 Чан
  }, PACK_SCAN_TIMEOUT);
});
