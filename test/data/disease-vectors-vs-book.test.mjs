// test/data/disease-vectors-vs-book.test.mjs
//
// Структурные векторы заражения (system.vectorTests, wdbc-dbveg) против текста
// «Путей передачи» (system.vectors) тех же болезней. Текст — слово книги, а
// структура — то, что читает кнопка «Заражение»: расхождение значило бы, что
// игрок бросает не тот Порог, который написан на листе болезни.
//
// Правило сверки: множество модификаторов T±N, найденных в тексте, равно
// множеству модификаторов vectorTests (порядок не важен). Болезни без T±N в
// тексте («авто-заражение», «на усмотрение МИ») не несут vectorTests — их
// заражение остаётся за ГМом, это честная граница книги.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const DISEASES = allPackDocuments("diseases").map(d => d.doc).filter(d => d.type === "disease");

// Т кириллицей и T латиницей — в книге и в паке встречаются оба; знак — минус, тире, дефис.
// Без \w/\b: русские буквы в них не входят (AGENTS.md, «Кириллица в регулярках»).
const MOD_RE = /(?<![A-Za-zА-Яа-яЁё])[ТT]\s*([+\-−–])\s*(\d+)/g;

function textMods(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(MOD_RE)) out.push((m[1] === "+" ? 1 : -1) * Number(m[2]));
  return [...new Set(out)].sort((a, b) => a - b);
}

describe("vectorTests против «Путей передачи»", () => {
  it("болезни в паке есть, и ровно 13 из них несут T±N в тексте", () => {
    expect(DISEASES.length).toBeGreaterThanOrEqual(18);
    const withText = DISEASES.filter(d => textMods(d.system.vectors).length);
    expect(withText.length).toBe(13);
  }, PACK_SCAN_TIMEOUT);

  for (const d of DISEASES) {
    it(`«${d.name}»: структура совпадает с текстом`, () => {
      const fromText = textMods(d.system.vectors);
      const tests = d.system.vectorTests ?? [];
      const fromData = [...new Set(tests.map(v => Number(v.mod)))].sort((a, b) => a - b);
      expect(fromData).toEqual(fromText);
      for (const v of tests) {
        expect(v.label, "подпись вектора").toBeTruthy();
        expect(v.char).toBe("t");
        expect(Number.isInteger(v.mod)).toBe(true);
      }
    }, PACK_SCAN_TIMEOUT);
  }
});
