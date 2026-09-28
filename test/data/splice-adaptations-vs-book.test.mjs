// test/data/splice-adaptations-vs-book.test.mjs
//
// Сплайс (Основная книга, «Отродия → Сплайс», «Адаптации»). Сторож с двух
// сторон: пак ↔ книга.
//  - 18 Черт-адаптаций: по 4 Сенсорных/Защитных/Атакующих и 6 Продвинутых,
//    русские имена — ровно книжные, текст benefit — книжный абзац;
//  - раса выдаёт выбор: по одной из трёх списков и «до 3» дополнительных
//    из всех 18 (Продвинутые — только там);
//  - Unnatural S/T/A/P (2) — выбор ИЛИ из четырёх Черт с рейтингом 2, а не
//    мёртвый шаблон «Unnatural (выбор)».

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packDocById } from "../support/pack-doc.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIR = path.join(ROOT, "packs-src/traits/Трейты_рас/Адаптации_Сплайса");
const adaptations = fs.readdirSync(DIR).filter(f => f.endsWith(".json") && f !== "_Folder.json")
  .map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));
const byKind = k => adaptations.filter(d => d.flags["warhammer-dbc"].spliceAdaptation === k);
const ruName = d => d.name.split(" / ")[1].replace(/^Адаптация:\s*/, "");

const BOOK = {
  sensory: ["Ищейка", "Ночной Хищник", "Электрочутье", "Эхолокация"],
  defensive: ["Амфибия", "Живучесть", "Защитные Рефлексы", "Чешуя/Панцирь"],
  offensive: ["Выдвижные Когти", "Большие Когти", "Огромная Пасть", "Хлыстовидные Мышцы"],
  advanced: ["Взрывное Действие", "Ладони на Ногах", "Проворный Хвост", "Перевертыш", "Продвинутая Физиология", "Регенерация"]
};

// Книга в паке: «<strong>Ищейка</strong>: Дает +30 …». Сравниваем без пробелов
// и видов тире — вёрстка книги их путает, слова — нет.
const core = fs.readFileSync(path.join(ROOT, "packs-src/books/core.json"), "utf8");
const norm = s => String(s).replace(/[\s ­–—-]+/g, "").replace(/ё/g, "е").toLowerCase();
function bookText(name) {
  const esc = name.replace(/[/]/g, "\\/");
  // У двух адаптаций книга в паке теряет <strong> — принимаем оба вида.
  const m = core.match(new RegExp(`>(?:<strong>)?${esc}(?:</strong>)?:\\s*([^<]+)`));
  return m ? m[1] : null;
}

describe("Адаптации Сплайса — Черты пака против книги", () => {
  for (const [kind, names] of Object.entries(BOOK)) {
    it(`${kind}: ровно книжный список`, () => {
      expect(byKind(kind).map(ruName).sort()).toEqual([...names].sort());
    });
  }

  it.each(adaptations.map(d => [ruName(d), d]))("%s — текст benefit книжный", (name, d) => {
    const book = bookText(name);
    expect(book, `в core.json нет «${name}»`).toBeTruthy();
    const first = d.system.benefit.split("\n")[0];
    expect(norm(first)).toBe(norm(book));
  });
});

describe("Раса Сплайс — выбор адаптаций и Unnatural", () => {
  const race = packDocById("packs-src/races/Отродия", "sNZXzmLfS7BZm0no");
  const groups = race.flags["warhammer-dbc"].mechanics;
  const entries = groups.flatMap(g => g.entries);
  const idsOf = kind => byKind(kind).map(d => d._id).sort();
  const picks = entries.filter(e => e.kind === "equipment" && e.equipCategoryPack === "traits");

  it("по одной из каждого основного списка", () => {
    for (const kind of ["sensory", "defensive", "offensive"]) {
      const e = picks.find(p => [...p.equipChoiceIds].sort().join() === idsOf(kind).join());
      expect(e, kind).toBeTruthy();
      expect(e.equipBudgetValue).toBe(1);
      expect(e.equipBudgetMin).toBeUndefined();
    }
  });

  it("дополнительные: от 0 до 3 из всех 18 (Продвинутые — только здесь)", () => {
    const extra = picks.find(p => p.equipChoiceIds.length === 18);
    expect(extra).toBeTruthy();
    expect(extra.equipBudgetValue).toBe(3);
    expect(extra.equipBudgetMin).toBe(0);
    const advanced = idsOf("advanced");
    for (const p of picks.filter(p => p !== extra))
      expect(p.equipChoiceIds.some(id => advanced.includes(id))).toBe(false);
  });

  it("Unnatural S или T или A или P (2) — выбор ИЛИ, мёртвого шаблона нет", () => {
    expect(entries.some(e => /Unnatural \(выбор\)/.test(e.sourceName || ""))).toBe(false);
    const or = groups.find(g => g.operator === "OR" && g.entries.every(e => /^Unnatural/.test(e.sourceName || "")));
    expect(or.entries.map(e => e.sourceName.split(" ")[1]).sort())
      .toEqual(["Agility", "Perception", "Strength", "Toughness"]);
    expect(or.entries.every(e => Number(e.rating) === 2)).toBe(true);
  });

  it("книжные поля расы: адаптации без выдуманных, снаряжение дословно", () => {
    expect(race.system.gear).toBe("5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q, Vox-Bead");
    for (const names of Object.values(BOOK)) for (const n of names) expect(race.system.adaptations).toContain(n);
    for (const bad of ["Жгучесть", "Эколокация", "Хлысткообразные", "Ядовитые"]) expect(race.system.adaptations).not.toContain(bad);
  });
});
