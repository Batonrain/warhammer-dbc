// test/data/legion-geneseed-size-vs-book.test.mjs
//
// РАЗМЕР ОТ ГЕНОСЕМЕНИ ЛЕГИОНА ПРОТИВ КНИГИ.
//
// Повод конкретный: Геносемя Альфа-Легиона делало персонажа Размера 2.
// В module/constants/legions.mjs у XX Альфа-Легиона и у Железных Змей стояло
// `effects: { sizeMod: 1 }`, потому что пересказ книги в том же файле был сжат
// до «(Размер 1)» — и прочитан как «+1 к Размеру». Книга говорит обратное:
// «Оссмодула – делает аспиранта на 10-25% выше обычного десантника (все еще в
// пределах Размера 1)», то есть выше ростом, но Размер НЕ меняется. Базовый
// Астартес и так Размер 1 (packs-src/races/Люди/Astartes…json), поэтому +1
// давал 2.
//
// Ошибку не видно ни в одном тесте: обе копии правила выглядят правдоподобно
// по отдельности, а расходятся они только в пересказе. Поэтому сторож смотрит
// на обе стороны сразу.
//
// Если однажды у какого-то легиона Геносемя ДЕЙСТВИТЕЛЬНО поднимет Размер,
// этот тест обязан упасть — и его нужно править вместе с книжной цитатой, а не
// молча ослаблять.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LEGIONS } from "../../module/constants/legions.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Плоский текст основной книги без разметки. */
function coreBookText() {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, "packs-src/books/core.json"), "utf8"));
  return book.entries
    .flatMap((e) => e.pages.map((p) => p.html || ""))
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

/** Все записи легионов и их орденов/банд одним списком. */
function everyLegionEntry() {
  return LEGIONS.flatMap((l) => [l, ...(l.chapters || [])]);
}

describe("Размер от Геносемени легиона", () => {
  it("ни одна запись не поднимает Размер — книга нигде этого не даёт", () => {
    const withSize = everyLegionEntry()
      .filter((e) => Number(e.effects?.sizeMod) || Number(e.effects?.sizeModNoSpd))
      .map((e) => `${e.num || ""} ${e.name}`.trim());
    expect(withSize).toEqual([]);
  });

  it("пересказ Геносемени не противоречит сам себе", () => {
    // «в пределах Размера N» значит «Размер не меняется» — с sizeMod несовместимо.
    const contradictory = everyLegionEntry()
      .filter((e) => /в пределах Размера/i.test(e.geneseed || "") && Number(e.effects?.sizeMod))
      .map((e) => `${e.num || ""} ${e.name}`.trim());
    expect(contradictory).toEqual([]);
  });

  it("книга подтверждает: «выше обычного десантника» — всё ещё в пределах своего Размера", () => {
    const text = coreBookText();
    const mentions = text.match(/.{0,80}выше обычного десантника.{0,80}/g) || [];
    expect(mentions.length).toBeGreaterThan(0);
    for (const m of mentions) expect(m).toMatch(/в пределах Размера/i);
  });

  it("оговорка книги дошла до пересказа в константах", () => {
    const stripped = everyLegionEntry()
      .filter((e) => /выше обычного десантника/i.test(e.geneseed || ""))
      .filter((e) => !/в пределах Размера/i.test(e.geneseed || ""))
      .map((e) => `${e.num || ""} ${e.name}`.trim());
    expect(stripped).toEqual([]);
  });
});
