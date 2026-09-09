// test/data/beastman-mutation-vs-race.test.mjs
//
// Мутация «Зверолюд» сама пишет в system.benefit: «получает ВСЕ Трейты расы
// Зверолюда (стр. 9), кроме The Quick and The Dead, Fast Learner, Aversion to
// Order и Stepchildren of the Gods». Значит рейтинги обязаны совпадать с расой,
// а не жить своей жизнью: карточка расы и карточка мутации — две копии одного
// книжного списка.
//
// Разъехались молча (ревью партии #432–#438): Укус, Сверхъестественная Сила и
// Сверхъестественная Стойкость стояли в мутации с рейтингом 1 при расовых 2 —
// вдвое слабее, и на листе это меньше Силы в уроне и меньше поглощения.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const MUTATION = "packs-src/mutations/Общие_мутации/Beastman___Зверолюд_Us9zsnoINwwU1iku.json";
const RACE     = "packs-src/races/Люди/Beastman___Зверолюд_aCWwJQUQSDbx1uEo.json";

/** Трейт → рейтинг (числом) по всем записям документа, где он назван sourceName. */
function traitRatings(doc) {
  const out = new Map();
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const name = node.sourceName;
    if (name && node.sourceHasRating && node.rating != null)
      out.set(String(name), Number(node.rating));
    Object.values(node).forEach(walk);
  })(doc);
  return out;
}

describe("мутация «Зверолюд» повторяет Трейты расы", () => {
  const inMutation = traitRatings(read(MUTATION));
  const inRace     = traitRatings(read(RACE));

  it("рейтинг каждого общего Трейта совпадает с расовым", () => {
    expect(inMutation.size, "в мутации не нашлось Трейтов с рейтингом").toBeGreaterThan(0);
    const diff = [];
    for (const [name, rating] of inMutation) {
      if (!inRace.has(name)) continue;          // Трейт не расовый — не наше дело
      if (inRace.get(name) !== rating)
        diff.push(`${name}: мутация ${rating}, раса ${inRace.get(name)}`);
    }
    expect(diff, "мутация обещает Трейты расы — рейтинги обязаны совпадать").toEqual([]);
  });
});
