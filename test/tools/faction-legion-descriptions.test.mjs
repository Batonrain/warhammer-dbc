// test/tools/faction-legion-descriptions.test.mjs
//
// ХРАПОВИК «КАРТОЧКА ЛЕГИОНА ГОВОРИТ ПРАВИЛА» (wdbc-i4y2).
//
// Из 998 «карточек без слов», замеренных тикетом, самой заметной кучей были
// Фракции: 83 из 123 пусты, и все 83 — Ордена Космодесанта и легионы/банды
// Хаоса. Книга прозы про них НЕ даёт: страница «ЧЕРТЫ ЛЕГИОНОВ» несёт по
// каждому ровно Геносемя, Культуру и Проклятье. Эти три вещи уже разобраны в
// module/constants/legions.mjs, откуда их берут Мастер создания и предикаты,
// и tools/faction-description-from-legions.mjs кладёт тот же текст в карточку.
//
// Гейт держит две вещи:
//  1. карточка легиона/ордена не пустеет обратно;
//  2. её текст не расходится с legions.mjs — если правило поменяли в
//     константе, карточка обязана поехать следом (перезапуск инструмента).
//
// Лишний абзац лора сверху разрешён: проверяется вхождение, не равенство.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LEGIONS } from "../../module/constants/legions.mjs";
import { legionIndex, russianName } from "../../tools/faction-description-from-legions.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FACTIONS = path.join(ROOT, "packs-src/factions");

/** Русское название карточки отличается от названия в legions.mjs. */
const ALIASES = { "осквернители": "насильники" };

/**
 * Записи legions.mjs, у которых карточки Фракции нет.
 *
 * Пусто, и так и должно быть: Мастер создания предлагает ровно те ордена, что
 * заведены в дереве принадлежностей. Шесть последних (Захватчики, Красные
 * Когти, Копья Императора, Серебряные Черепа, Освящённые, Кархародоны) заведены
 * 08.09.2026; список оставлен, чтобы новый орден в константе без карточки ронял
 * тест, а не тонул молча.
 */
const NO_CARD = [];

const norm = (s) => String(s || "")
  .replace(/­/g, "").replace(/ё/gi, "е").toLowerCase()
  .replace(/[«»"']/g, "").replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

/** Карточки Фракций, которым legions.mjs даёт правила. */
function cards() {
  const idx = legionIndex();
  const out = [];
  for (const file of walk(FACTIONS)) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (doc?.type !== "faction") continue;
    const key = norm(russianName(doc.name));
    const rec = idx.get(ALIASES[key] || key);
    if (rec) out.push({ doc, rec, key: ALIASES[key] || key });
  }
  return out;
}

/** Текст без разметки — сравнивать удобнее, чем HTML. */
const plain = (html) => String(html || "")
  .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

describe("Фракции легионов и орденов несут правила из legions.mjs", () => {
  const list = cards();

  it("карточки нашлись — иначе гейт молчал бы впустую", () => {
    expect(list.length).toBeGreaterThanOrEqual(89);
  });

  it("ни одна карточка легиона/ордена не пуста", () => {
    const empty = list.filter(c => !plain(c.doc.system?.description)).map(c => c.doc.name);
    expect(empty).toEqual([]);
  });

  it("текст карточки не разошёлся с legions.mjs", () => {
    const drift = [];
    for (const { doc, rec } of list) {
      const text = plain(doc.system?.description);
      const want = [rec.geneseed, rec.culture];
      if (rec.curseChoices?.length) want.push(...rec.curseChoices.map(c => c.text));
      else want.push(rec.curse);
      for (const w of want) {
        if (!w) continue;
        if (!text.includes(plain(w))) drift.push(`${doc.name}: нет «${plain(w).slice(0, 60)}…»`);
      }
    }
    expect(drift).toEqual([]);
  });

  it("записи legions.mjs без карточки Фракции — только известные", () => {
    const have = new Set(cards().map(c => c.key));
    const idx = legionIndex();
    const orphans = [...idx.keys()].filter(k => !have.has(k)).sort();
    expect(orphans).toEqual([...NO_CARD].sort());
  });

  it("в legions.mjs нет записи без имени — по имени идёт всё сопоставление", () => {
    const all = LEGIONS.flatMap(l => [l, ...(l.chapters || [])]);
    expect(all.filter(r => !String(r.name || "").trim())).toEqual([]);
  });
});
