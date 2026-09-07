// test/data/granted-trait-rating.test.mjs
//
// ОБЩИЙ СТОРОЖ ПУСТОГО РЕЙТИНГА (wdbc-w27k). Соседний тест
// fast-learner-race-rating.test.mjs сверяет по книге одну конкретную Черту;
// здесь проверяется сам класс поломки, независимо от того, какая Черта.
//
// Запись Конструктора kind:"trait" со снятым флажком sourceHasRating говорит
// «у этой Черты рейтинга нет» — пустое поле там нормально. А вот
// sourceHasRating:true при ПУСТОМ rating — это молчаливая дыра: применение
// присваивает рейтинг только когда поле непустое
// (module/apps/mechanics.mjs — `if (e.rating !== "" && e.rating != null)`),
// поэтому персонаж получает собственный rating Черты-ШАБЛОНА из компендиума.
// Шаблон хранит заглушку, а не книжное число, и на листе всё выглядит
// правдоподобно: Нага получала Multiple Arms (2) вместо (4) — то есть две
// руки, которые есть у всех, и ни одной дополнительной атаки.
//
// Правило: если запись объявила, что рейтинг у Черты есть, число обязано быть
// написано ЯВНО. Совпадение с заглушкой шаблона — не оправдание: заглушка
// меняется отдельно от выдачи и уносит с собой все такие записи разом.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src");

function listJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Все записи Конструктора документа, вместе с его именем и путём. */
function mechEntries(file) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
  const groups = doc?.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) return [];
  const out = [];
  for (const g of groups) {
    for (const e of g?.entries ?? []) out.push({ doc, file, entry: e });
  }
  return out;
}

const FILES = listJson(ROOT);

describe("выдаваемые Черты: рейтинг проставлен явно", () => {
  it("packs-src вообще разобран — иначе тест зелен от пустоты", () => {
    expect(FILES.length).toBeGreaterThan(1000);
    const withMech = FILES.filter(f => mechEntries(f).length);
    expect(withMech.length).toBeGreaterThan(50);
  });

  it("ни одна запись kind:\"trait\" с рейтингом не оставлена пустой", () => {
    const holes = [];
    for (const file of FILES) {
      for (const { doc, entry } of mechEntries(file)) {
        if (entry?.kind !== "trait" || !entry?.sourceHasRating) continue;
        const rating = entry.rating;
        if (rating === "" || rating === null || rating === undefined) {
          holes.push(`${doc.name} → ${entry.sourceName}`);
        }
      }
    }
    expect(holes, holes.join("\n")).toEqual([]);
  });

  it("Нага получает четыре руки, как в книге, а не заглушку шаблона", () => {
    // Именной случай из wdbc-w27k: при X=2 Черта не даёт вообще ничего (две
    // руки есть у всех), и дополнительные атаки парой рук не появляются.
    const naga = FILES.map(f => mechEntries(f)).flat()
      .filter(({ doc }) => String(doc.name || "").includes("Нага"));
    const arms = naga.find(({ entry }) => String(entry.sourceName || "").includes("Multiple Arms"));
    expect(arms, "у Наги пропала выдача Multiple Arms").toBeTruthy();
    expect(String(arms.entry.rating)).toBe("4");
  });
});
