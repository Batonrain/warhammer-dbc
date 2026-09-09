// test/tools/card-description-from-book.test.mjs
//
// Инструмент берёт прозу из книги по строке-заголовку с именем. Книга
// свёрстана в ДВЕ КОЛОНКИ: заголовки идут парой, абзацы — парой следом,
// поэтому разбор способен прихватить абзац соседа. Так 25 карточек получили
// чужое описание (Ремесленник носил описание Погонщика), и чинили их руками.
//
// Отличить свой абзац от соседнего по одному тексту нечем — значит инструмент
// не должен решать это молча: запись только по --write, а находки из
// нескольких абзацев называются человеку (wdbc-86h).

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { proseAfter, findProse } from "../../tools/card-description-from-book.mjs";

const root = path.resolve(import.meta.dirname, "../..");

describe("разбор прозы после заголовка", () => {
  const long = n => `${n} ${"я".repeat(70)}`;

  it("берёт длинные строки до заголовка с двоеточием", () => {
    const lines = ["Ремесленник", long("свой абзац"), "Требования:", long("не проза")];
    expect(proseAfter(lines, 0)).toEqual([long("свой абзац")]);
  });

  it("останавливается на короткой строке — это снова заголовок", () => {
    const lines = ["Ремесленник", long("свой абзац"), "Погонщик", long("чужой абзац")];
    expect(proseAfter(lines, 0)).toEqual([long("свой абзац")]);
  });

  it("имя в нескольких книгах — решает человек, автоматом не берём", () => {
    const page = name => ({ book: name, page: "p", lines: ["Ремесленник", long("текст")] });
    expect(findProse([page("core"), page("chaos")], "Ремесленник")).toBe(null);
  });
});

describe("инструмент не пишет молча", () => {
  const src = fs.readFileSync(path.join(root, "tools/card-description-from-book.mjs"), "utf8");

  it("по умолчанию сухой прогон", () => {
    expect(src).toMatch(/run\(\{\s*dry = true/);
  });

  it("запись — только по явному --write", () => {
    expect(src).toContain('const dry = !process.argv.includes("--write");');
  });

  it("находка из нескольких абзацев помечается для сверки глазами", () => {
    expect(src).toContain("ГЛАЗАМИ");
  });
});
