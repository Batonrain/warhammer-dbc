// test/rules/req-atom.test.mjs
//
// wdbc-0pki: общий слой «атом требования» — статов и наличия предмета по
// имени. Три движка Требований (mechanics.mjs/elite-requirements.mjs/
// talent-requirements.mjs) уже покрыты сквозным
// test/rules/req-atom-cross-engine-snapshot.test.mjs; этот файл — юнит-тесты
// самого общего слоя в изоляции.

import { describe, it, expect } from "vitest";
import { rankIndex, rankAtLeast, statValue, statAtLeast, itemsNamed, hasItemNamed }
  from "../../module/rules/req-atom.mjs";

const actor = ({ chars = {}, corruption = 0, psyRating = 0, items = [] } = {}) => {
  const characteristics = {};
  for (const [k, v] of Object.entries(chars)) characteristics[k] = { total: v };
  return { system: { characteristics, corruption: { value: corruption }, psyker: { rating: psyRating } }, items };
};

describe("rankIndex", () => {
  it("растёт вместе со знанием", () => {
    expect(rankIndex("untrained")).toBe(0);
    expect(rankIndex("knows")).toBe(1);
    expect(rankIndex("expert")).toBe(4);
  });

  it("пустой/незнакомый ранг — untrained", () => {
    expect(rankIndex("")).toBe(0);
    expect(rankIndex(undefined)).toBe(0);
    expect(rankIndex("bogus")).toBe(0);
  });
});

describe("rankAtLeast", () => {
  it("сравнивает по индексу шкалы", () => {
    expect(rankAtLeast("trained", "knows")).toBe(true);
    expect(rankAtLeast("trained", "trained")).toBe(true);
    expect(rankAtLeast("knows", "trained")).toBe(false);
  });

  it("отсутствующий ранг актора — untrained, не проходит ничего кроме untrained", () => {
    expect(rankAtLeast(undefined, "untrained")).toBe(true);
    expect(rankAtLeast(undefined, "knows")).toBe(false);
  });
});

describe("statValue / statAtLeast", () => {
  it("характеристика читается из system.characteristics", () => {
    const a = actor({ chars: { ws: 40 } });
    expect(statValue(a, "ws")).toBe(40);
    expect(statAtLeast(a, "ws", 40)).toBe(true);
    expect(statAtLeast(a, "ws", 41)).toBe(false);
  });

  it("corruption и psyRating — отдельные поля, не характеристики", () => {
    const a = actor({ corruption: 20, psyRating: 3 });
    expect(statValue(a, "corruption")).toBe(20);
    expect(statValue(a, "psyRating")).toBe(3);
    expect(statAtLeast(a, "corruption", 20)).toBe(true);
    expect(statAtLeast(a, "psyRating", 4)).toBe(false);
  });

  it("отсутствующий показатель — 0, не исключение", () => {
    expect(statValue(actor(), "ws")).toBe(0);
    expect(statValue({}, "corruption")).toBe(0);
  });
});

describe("itemsNamed / hasItemNamed", () => {
  const a = actor({ items: [
    { type: "talent", name: "Frenzy", system: {} },
    { type: "trait", name: "Iron Will", system: {} },
    { type: "trait", name: "Sus-an Membrane / Сус-ан Мембрана", system: {} }
  ] });

  it("находит по точному имени, тип фильтрует", () => {
    expect(hasItemNamed(a, "Frenzy", ["talent"])).toBe(true);
    expect(hasItemNamed(a, "Frenzy", ["trait"])).toBe(false);
    expect(hasItemNamed(a, "Frenzy")).toBe(true);
  });

  it("вхождением НЕ находит — «Will» не находит «Iron Will»", () => {
    expect(hasItemNamed(a, "Will")).toBe(false);
  });

  it("двуязычное имя — находится по любой половине", () => {
    expect(hasItemNamed(a, "Sus-an Membrane")).toBe(true);
    expect(hasItemNamed(a, "Сус-ан Мембрана")).toBe(true);
  });

  it("пустое имя не находит ничего", () => {
    expect(itemsNamed(a, "")).toEqual([]);
    expect(itemsNamed(a, null)).toEqual([]);
  });
});
