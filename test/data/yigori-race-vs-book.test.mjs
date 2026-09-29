// test/data/yigori-race-vs-book.test.mjs
//
// Раса Йигори против книги (корбук, глава I, сверка 28.09.2026). Сторож
// race-traits-vs-book смотрит только блок «Стартовые Трейты» — и молчал про
// Unnatural Intelligence вместо Unnatural Toughness: в core.json «Unnatural Т
// (2)» набрано кириллической «Т», разбор строки на ней обрывал список после
// первого пункта. Раздел «Трейты:» (Angel Hunters и соседи) не сверяет никто.
// Здесь — оба списка книги и текст снаряжения, который разбирает Этап 5
// Мастера создания.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { packDocuments } from "../support/pack-docs.mjs";
import { RACES } from "../../module/constants/races.mjs";

const RACE = packDocById("packs-src/races/Люди", "e2xIC6AzLAzO50uz");
const traitEntries = RACE.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "trait");
const english = name => String(name).split("/")[0].replace(/\(.*?\)/g, "").trim();

describe("Йигори: Черты расы = книга", () => {
  it("Стартовые Трейты: Unnatural S/T/A — рейтинг 2, и никакого Интеллекта", () => {
    const rating = n => traitEntries.find(e => english(e.sourceName) === n)?.rating;
    expect(rating("Unnatural Strength")).toBe(2);
    expect(rating("Unnatural Toughness")).toBe(2);
    expect(rating("Unnatural Agility")).toBe(2);
    expect(traitEntries.some(e => english(e.sourceName).startsWith("Unnatural Intelligence"))).toBe(false);
  });

  it("раздел «Трейты:» книги — все пять, имена как в книге", () => {
    const names = traitEntries.map(e => english(e.sourceName));
    for (const n of ["The Quick and The Dead", "New Men", "Angel Hunters", "Pack Consciousness", "Pheromone Glands"])
      expect(names, n).toContain(n);
  });

  it("каждая запись ведёт к существующей Черте пака с тем же именем", () => {
    const byId = new Map(packDocuments("traits", "trait").map(({ doc }) => [doc._id, doc]));
    for (const e of traitEntries) {
      expect(byId.get(e.sourceUuid.split(".").pop())?.name, e.sourceName).toBe(e.sourceName);
    }
  });

  it("снаряжение — дословно книга, резерв-константы с ним согласны", () => {
    const book = "5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q, Vox-Bead";
    expect(RACE.system.gear).toBe(book);
    expect(RACES.yigori.gear).toBe(book);
  });

  it("резерв-константы: те же стартовые Характеристики, что в паке", () => {
    expect(RACES.yigori.chars).toEqual(RACE.system.chars);
  });
});
