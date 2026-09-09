// test/data/chassis-notes-vs-book.test.mjs
//
// ПАМЯТКА ПО ХОДОВОЙ ПРОТИВ КНИГИ (wdbc-6wzt).
//
// Полное правило Ходовой лежит в двух местах сразу: в книге
// (packs-src/books/machines.json, «I. МЕХАНИКА МАШИН → ХОДОВАЯ») и в
// module/constants/vehicle.mjs, откуда лист берёт подсказку. Две копии одного
// текста расходятся тем вернее, чем дольше живут, и заметить это за столом
// нельзя: подсказка выглядит правдоподобно в любом случае.
//
// Повод завести сторож конкретный. В комментарии у CHASSIS_FULL_NOTES стояло,
// что этой страницы в packs-src/books нет вовсе и текст записан со слов
// владельца. Сверка 07.09.2026 показала обратное: страница разобрана, и все
// девять пунктов совпадают с книжными слово в слово. То есть система уже
// работала с двумя источниками правды, не зная об этом.
//
// Проверяется не побуквенное совпадение (памятка местами короче книги — это
// намеренно, она живёт в подсказке), а то, что книжный раздел на месте, число
// пунктов совпадает и все несущие числа правила присутствуют в обеих копиях.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CHASSIS_FULL_NOTES, CHASSIS_TYPES } from "../../module/constants/vehicle.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Текст страницы «ХОДОВАЯ» Книги Машин, строками. */
function chassisPageLines() {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, "packs-src/books/machines.json"), "utf8"));
  const page = book.entries.flatMap(e => e.pages || []).find(p => p.name === "ХОДОВАЯ");
  if (!page) return null;
  return String(page.html)
    .replace(/<[^>]+>/g, "\n")
    .replace(/&[a-z]+;/gi, " ")
    .split("\n")
    .map(s => s.replace(/­/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Пункты одного типа Ходовой: от его заголовка до заголовка следующего. */
function bookBullets(lines, heading) {
  const from = lines.findIndex(l => l === heading);
  if (from < 0) return null;
  const out = [];
  for (let i = from + 1; i < lines.length; i++) {
    // Заголовок следующего типа Ходовой — «Skimmer / Скиммер» и подобные.
    if (/^[A-Z][A-Za-z]+ \/ [А-ЯЁ]/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

describe("памятка по Ходовой не расходится с Книгой Машин", () => {
  const lines = chassisPageLines();

  it("страница «ХОДОВАЯ» в разобранной книге есть", () => {
    // Если она исчезнет (пересборка книги, правка разбора), сторож должен
    // падать здесь, а не тихо перестать проверять.
    expect(lines, "в packs-src/books/machines.json нет страницы «ХОДОВАЯ»").not.toBeNull();
    expect(lines.some(l => l.includes("Ходовая определяет тип движения"))).toBe(true);
  });

  it("у Шагохода столько же пунктов, сколько в книге", () => {
    const book = bookBullets(lines, "Walker / Шагоход");
    expect(book, "в книге пропал раздел «Walker / Шагоход»").not.toBeNull();
    // Книга разрывает один пункт про S/Un.S на три строки формулой в середине
    // («…в формате», «(SPD, S+Un.S=S.b)», «. Может использовать…») и так же —
    // пункт про Combat Master. Сравнивать построчно поэтому нельзя; сравнимо
    // число ПРАВИЛ, а его даёт число строк, начинающихся с заглавной буквы
    // после точки — то есть самостоятельных предложений-пунктов.
    const bullets = book.filter(l => /^[А-ЯЁA-Z]/.test(l) && l.length > 40);
    expect(bullets.length).toBe(CHASSIS_FULL_NOTES.walker.length);
  });

  it("несущие числа правила есть и в книге, и в памятке", () => {
    const book = bookBullets(lines, "Walker / Шагоход").join(" ");
    const note = CHASSIS_FULL_NOTES.walker.join(" ");
    for (const key of ["4×SPD", "6×SPD", "180", "Multiple Arms", "Operate", "Натиск", "Карабканье"]) {
      expect(book.replace(/–/g, "−"), `в книге пропало «${key}»`).toContain(key);
      expect(note.replace(/–/g, "−"), `в памятке пропало «${key}»`).toContain(key);
    }
  });

  it("каждый тип Ходовой из справочника назван в книге", () => {
    // Список типов на листе и список в книге — тоже две копии. Сравнение без
    // «ё»: книга пишет «Колесная», справочник — «Колёсная», и это не
    // расхождение правил, а обычная русская орфография.
    const noYo = s => s.replace(/ё/g, "е");
    const text = noYo(lines.join(" "));
    for (const russian of Object.values(CHASSIS_TYPES)) {
      expect(text.includes(noYo(russian)), `в книге нет Ходовой «${russian}»`).toBe(true);
    }
  });
});
