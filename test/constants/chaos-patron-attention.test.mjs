// test/constants/chaos-patron-attention.test.mjs
//
// Тексты «Бог обращает внимание на…» (подсказка выбора Покровителя) —
// дословно из корбука. Сторож сверяет их с core.json: пока слова в подсказке
// те же, что в книге, расхождение не накопится.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { GOD_ATTENTION, godAttentionTip } from "../../module/constants/chaos-patron.mjs";

// Книга в JSON: убираем разметку и переносы, схлопываем пробелы.
const book = fs.readFileSync(new URL("../../packs-src/books/core.json", import.meta.url), "utf8")
  .replace(/\\"/g, "\"").replace(/<[^>]*>/g, " ").replace(/\\n/g, " ").replace(/\s+/g, " ");

const BOOK_NAME = { slaanesh: "Слаанеш", nurgle: "Нургл", khorne: "Кхорн", tzeentch: "Тзинч" };

describe("«Бог обращает внимание на…» — по книге", () => {
  for (const [key, text] of Object.entries(GOD_ATTENTION)) {
    it(`${BOOK_NAME[key]}: фраза есть в core.json дословно`, () => {
      expect(book).toContain(`${BOOK_NAME[key]} обращает внимание на ${text}.`);
    });
  }

  it("подсказка называет Бога и ведёт его фразой", () => {
    expect(godAttentionTip("khorne")).toBe(`Кхорн обращает внимание на ${GOD_ATTENTION.khorne}.`);
  });

  it("у Неделимого и незнакомого ключа подсказки нет", () => {
    expect(godAttentionTip("undivided")).toBe("");
    expect(godAttentionTip("")).toBe("");
  });
});
