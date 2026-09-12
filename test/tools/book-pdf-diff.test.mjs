// test/tools/book-pdf-diff.test.mjs
//
// tools/book-pdf-diff.py снимает HTML-теги, заменяя их пробелом, чтобы
// сравнить текст книги с текстом PDF. Наивная замена ЗАКРЫВАЮЩЕГО тега на
// пробел перед знаком препинания создаёт то, чего нет ни в PDF, ни по
// смыслу: «<strong>Poor.Q</strong>: считается» превращалось в
// «Poor.Q : считается» — с лишним пробелом перед двоеточием. Проверка
// «подпись из PDF есть в тексте книги» (bold_lines → book_plain) после
// этого не находила «Poor.Q:» (в PDF знак препинания всегда приклеен к
// слову) и рапортовала ложную пропажу текста. Найдено book-proofreader на
// core.json стр. 243-288 (wdbc-ld7g), заведено как wdbc-i0yf.
//
// Тест гоняет сам скрипт (через его собственный механизм импорта), а не
// копию логики на JS — как и test/tools/merge-book-pages.test.mjs это
// делает для соседнего инструмента конвейера книг.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const TOOL = join(import.meta.dirname, "../../tools/book-pdf-diff.py");

// Мини-скрипт на Python: подгружает book-pdf-diff.py как модуль (без
// pymupdf — он импортируется только внутри main(), сюда не доезжает) и
// печатает JSON с результатами вызовов strip_tags/words на конкретных
// случаях.
const PY = `
import sys, json, importlib.util
spec = importlib.util.spec_from_file_location("bpd", ${JSON.stringify(TOOL)})
bpd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bpd)

out = {
    # Реальный кейс из тикета (core.json, стр. 243): жирная подпись перед
    # двоеточием не должна обрастать пробелом.
    "case_colon": bpd.strip_tags("<p><em><strong>Poor.Q</strong>: не позволяет</em></p>"),
    # Точка/запятая/точка с запятой/восклицательный/вопросительный — тот же
    # класс знаков, что и двоеточие.
    "case_all_punct": bpd.strip_tags(
        "<strong>А</strong>. <strong>Б</strong>, <strong>В</strong>; "
        "<strong>Г</strong>! <strong>Д</strong>?"),
    # Тег между двумя словами без знака препинания обязан оставить разделитель
    # — иначе соседние слова слипаются в одно.
    "case_word_boundary": bpd.words("<p>слово</strong>Иначе другое</p>"),
}
print(json.dumps(out, ensure_ascii=False))
`;

const run = () => {
  // PYTHONIOENCODING=utf-8: на Windows консольная кодировка иначе портит
  // кириллицу в stdout (та же оговорка есть в шапке самого book-pdf-diff.py).
  const r = spawnSync("python3", ["-c", PY], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return JSON.parse(r.stdout);
};

describe("book-pdf-diff.py: снятие тегов не создаёт пробел перед пунктуацией", () => {
  it("не оставляет пробел между жирной подписью и последующим знаком препинания", () => {
    const { case_colon } = run();
    expect(case_colon).not.toMatch(/\s+:/);
    expect(case_colon.replace(/\s+/g, " ").trim()).toBe("Poor.Q: не позволяет");
  });

  it("то же для точки, запятой, точки с запятой, ! и ?", () => {
    const { case_all_punct } = run();
    for (const p of [".", ",", ";", "!", "?"]) {
      expect(case_all_punct).not.toMatch(new RegExp(`\\s+\\${p}`));
    }
  });

  it("между словами по разные стороны снятого тега разделитель остаётся", () => {
    const { case_word_boundary } = run();
    expect(case_word_boundary).toEqual(["слово", "иначе", "другое"]);
  });
});
