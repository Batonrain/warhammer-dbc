// test/support/book-weapon-rows.mjs
//
// Разбор оружейных таблиц книг (packs-src/books) в группы режимов: одно оружие
// = одна группа со списком режимов (бросок, тип, подвид). Общий для сторожа
// test/data/damage-notation-vs-book.test.mjs и разовых инструментов правки по
// книге — чтобы логика сопоставления жила в одном месте (wdbc-wdq0r).

import fs from "node:fs";
import path from "node:path";
import { PACKS_SRC } from "./pack-docs.mjs";

export const TYPE = { I: "impact", R: "rending", E: "energy", X: "blast", C: "chemical" };
export const SUB = { Cr: "crushing", Fr: "fragmentation", El: "electrical", Fl: "flame", Ls: "laser", Tx: "toxic" };
export const DMG_RE = /(\d*d\d+(?:\s*[+−–-]\s*\d+)?)\s*([IREXC])(?:\s*\(\s*(\w+)\s*\))?/;

/** «2d10 + 6» / «2d10+6» / «2d10−1» / «1d10–2» → одна форма для сравнения. */
export const normDice = s => String(s ?? "").replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase();

/**
 * Имя для сопоставления (wdbc-w0s5.2): регистр, ё/е, апострофы ’/', тире –/-,
 * пометки в скобках («[Legion]», «(Астартес)», «(имплант)») и префикс
 * карточек Книги Машин «R: 4 |» не различают предмет и строку книги. От
 * случайных тёзок страхует совпадение броска урона, а не имя.
 */
export const normName = s => String(s ?? "").toLowerCase()
  .replace(/^.*\|/, "")
  .replace(/ё/g, "е").replace(/[’‘`]/g, "'").replace(/[–—]/g, "-")
  .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
  .replace(/\s+/g, " ").trim();

/** Обе половины двуязычного имени «English / Русское», нормализованные. */
export const nameKeys = full => {
  const [en, ru] = String(full ?? "").replace(/^.*\|/, "").split("/");
  return [normName(en), normName(ru)].filter(Boolean);
};

/** Ячейка таблицы: текст целиком и строки-абзацы внутри (режимы оружия лежат по <p>). */
export function parseCell(html) {
  const lines = String(html).split(/<\/p>|<br\s*\/?>/).map(x => x.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
  return { text: String(html).replace(/<[^>]+>/g, "").trim(), lines };
}

/** Режимы из ячейки урона: по строке-абзацу на режим; «[…]» — Легионная версия ТОГО ЖЕ режима. */
export function modesFromDamageCell(cell, book) {
  const out = [];
  for (const line of cell.lines.length ? cell.lines : [cell.text]) {
    const variants = line.split("[").map(pt => pt.match(DMG_RE)).filter(Boolean);
    if (!variants.length) continue;
    const m = variants[0];
    out.push({ dice: variants.map(v => normDice(v[1])), type: TYPE[m[2]], sub: m[3] ? (SUB[m[3]] ?? "") : "",
      raw: line.slice(0, 40), book });
  }
  return out;
}

/**
 * Книжные ГРУППЫ строк: одно оружие = одна группа со списком режимов. Форматы:
 *  • обычный — имя в первой ячейке строки;
 *  • rowspan — имя в первой строке, режимы («Топор/Крюк/Копье/Посох»)
 *    следующими строками без имени (основная книга, wdbc-wdq0r);
 *  • режимы абзацами в одной ячейке (книги Аэльдари: «1d10+9 R» + «1d10 I(Cr)»);
 *  • карточный Книги Машин/техники эльдар — строка-заголовок «R: 4 | Name /
 *    Имя» на всю ширину, под ней строка характеристик без имени.
 * Возвращает { byName: имя → [режим с полем group], groups }.
 */
export function bookRows() {
  const byName = new Map();
  const groups = [];
  const dir = path.join(PACKS_SRC, "books");
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const ch of data.entries) for (const p of ch.pages) {
      let pendingName = null;
      let span = null; // { group, left } — открытая rowspan-группа
      for (const tr of p.html.match(/<tr[^>]*>.*?<\/tr>/g) ?? []) {
        const tds = [...tr.matchAll(/<td([^>]*)>(.*?)<\/td>/g)];
        const cells = tds.map(m => parseCell(m[2]));
        if (cells.length === 1) { pendingName = cells[0].text.includes("/") ? cells[0].text : null; span = null; continue; }
        const dmgCell = cells.find(c => /^\s*\d*d\d+/.test(c.text) && DMG_RE.test(c.text));
        const first = cells[0]?.text ?? "";
        // Продолжение rowspan-группы: строка режима без имени.
        if (span && span.left > 0 && !first.includes("/")) {
          span.left--;
          if (dmgCell) for (const mode of modesFromDamageCell(dmgCell, f)) span.group.modes.push(mode);
          continue;
        }
        span = null;
        if (cells.length < 3 || !dmgCell) continue;
        const nameCell = first.includes("/") ? first : pendingName;
        pendingName = null;
        if (!nameCell) continue;
        const group = { name: nameCell, book: f, modes: modesFromDamageCell(dmgCell, f) };
        groups.push(group);
        const rowspan = Number((tds[0][1].match(/rowspan="(\d+)"/) || [])[1]) || 1;
        if (rowspan > 1) span = { group, left: rowspan - 1 };
      }
    }
  }
  // Индекс по имени строится после обхода: rowspan-режимы дописываются в группу позже.
  for (const group of groups) {
    for (const mode of group.modes) {
      mode.group = group;
      for (const dice of mode.dice) {
        const rec = { ...mode, dice };
        for (const key of nameKeys(group.name)) {
          const list = byName.get(key) ?? [];
          list.push(rec);
          byName.set(key, list);
        }
      }
    }
  }
  return byName;
}

