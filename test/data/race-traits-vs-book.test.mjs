// test/data/race-traits-vs-book.test.mjs
//
// СТАРТОВЫЕ ТРЕЙТЫ РАС ПРОТИВ ТЕКСТА КНИГИ (wdbc-of5q).
//
// Повод конкретный. Тикет wdbc-w27k искал ПУСТЫЕ рейтинги у выдаваемых Черт и
// нашёл у Наги один. Сверка её блока с корбуком целиком показала, что неверны
// были ещё три — и они не пустые, а просто с другим числом: Bite (1) вместо
// (3), Natural Armour (1) вместо (3), Toxic (1) вместо (3). Ни один перебор по
// пустым полям такого не видит и увидеть не может: чтобы отличить верную «1»
// от неверной, нужен текст книги.
//
// Здесь он и берётся — из packs-src/books/core.json, страницы «РАСЫ». Это тот
// же приём, что у test/data/fast-learner-race-rating.test.mjs, но не для одной
// Черты, а для всех Трейтов всех рас корбука разом.
//
// Разбор живёт в tools/race-traits-vs-book.mjs, здесь — только гейт.

import { describe, it, expect } from "vitest";
import { compareRaces } from "../../tools/race-traits-vs-book.mjs";

describe("стартовые Трейты рас совпадают с книгой", () => {
  const report = compareRaces();

  it("сверка вообще нашла расы — иначе тест зелен от пустоты", () => {
    // Если разметка книги поменяется и разбор перестанет находить разделы,
    // тест должен упасть здесь, а не тихо перестать проверять.
    expect(report.length).toBeGreaterThanOrEqual(10);
    expect(report.every(r => r.bookCount > 0)).toBe(true);
  });

  it("ни у одной расы нет расхождения с книгой", () => {
    const bad = report.filter(r => r.problems.length);
    const text = bad.map(r => `${r.race}:\n${r.problems.map(p => `    • ${p}`).join("\n")}`).join("\n");
    expect(bad, `расходятся с книгой:\n${text}`).toEqual([]);
  });
});
