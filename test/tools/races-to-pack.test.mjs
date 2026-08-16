// test/tools/races-to-pack.test.mjs
//
// Перенос рас из констант в пак. Проверяется не «файлы записались», а то, что
// содержимое доехало без потерь: состав Черт, рейтинги, группы, стартовые
// характеристики. Расхождение здесь означает, что персонаж после переезда
// получит не ту расу, что раньше.

import { describe, it, expect } from "vitest";
import { RACES, SUBRACES, SUBRACE_DATA, RACE_GROUPS } from "../../module/constants/races.mjs";
import { raceDocs, traitEntries } from "../../tools/races-to-pack.mjs";
import { missingRaceTraits } from "../../tools/race-traits.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const docs = () => raceDocs().map(d => d.doc);
const byKey = type => new Map(docs().filter(d => d.type === type).map(d => [d.system.key, d]));

describe("расы в пак", () => {

  it("каждая раса и каждая субраса получили документ", () => {
    expect(byKey("race").size).toBe(Object.keys(RACES).length);
    expect(byKey("subrace").size).toBe(Object.keys(SUBRACES).length);
  });

  // eldanar и grayman есть только меткой, без данных: пустая запись честнее
  // пропажи — субрасу видно в списке и в неё можно дописать книгу.
  it("субрасы без данных тоже заведены, с родителем и без механики", () => {
    const eldanar = byKey("subrace").get("eldanar");

    expect(eldanar.name).toBe("Эльданар");
    expect(eldanar.system.parentKey).toBe("azuriane");
    expect(eldanar.flags["warhammer-dbc"].mechanics).toEqual([]);
  });

  it("стартовые характеристики и группа перенесены как есть", () => {
    const astartes = byKey("race").get("astartes");

    expect(astartes.system.chars).toEqual(RACES.astartes.chars);
    expect(astartes.system.group).toBe("Люди");
    expect(astartes.system.hasGeneSeed).toBe(true);
    expect(astartes.system.bonusRolls).toBe(RACES.astartes.bonusRolls);
  });

  it("группа «Аэльдари» повторяет прежний список аэльдарийских рас", () => {
    const fromDocs = docs().filter(d => d.type === "race" && d.system.group === "Аэльдари")
      .map(d => d.system.key).sort();
    const fromConst = RACE_GROUPS.find(g => g.label === "Аэльдари").races.slice().sort();

    expect(fromDocs).toEqual(fromConst);
  });

  it("Черты стали записями Конструктора: имя, рейтинг, вид", () => {
    const entries = traitEntries(RACES.astartes);
    const strength = entries.find(e => /Unnatural Strength/.test(e.sourceName));

    expect(entries).toHaveLength(RACES.astartes.traits.length);
    expect(entries.every(e => e.kind === "trait")).toBe(true);
    expect(strength.rating).toBe(4);
    expect(strength.sourceHasRating).toBe(true);
  });

  // Это главная проверка связи с библиотекой. Рантайм ищет источник в
  // resolveMechSource: сперва по sourceUuid, и только потом по имени — а имена
  // он сравнивает БЕЗ отбрасывания скобок, поэтому «(4)» против шаблона «(X)»
  // не совпало бы никогда. Без uuid Черта пришла бы пустой, и Астартес получил
  // бы +0 вместо +4, ничего не сообщив.
  it("каждая запись ссылается по UUID на существующий документ библиотеки", () => {
    const ids = new Set(packDocuments("traits", "trait").map(({ doc }) => doc._id));

    for (const doc of docs()) {
      for (const g of doc.flags["warhammer-dbc"].mechanics) {
        for (const e of g.entries) {
          expect(e.sourceUuid).toMatch(/^Compendium\.warhammer-dbc\.traits\.Item\./);
          expect(ids.has(e.sourceUuid.split(".").pop())).toBe(true);
        }
      }
    }
  });

  it("имя в записи — точное имя документа библиотеки, а не название из констант", () => {
    const byId = new Map(packDocuments("traits", "trait").map(({ doc }) => [doc._id, doc.name]));

    for (const doc of docs())
      for (const g of doc.flags["warhammer-dbc"].mechanics)
        for (const e of g.entries)
          expect(e.sourceName).toBe(byId.get(e.sourceUuid.split(".").pop()));
  });

  it("ни одна расовая Черта не осталась без пары в библиотеке", () => {
    expect(missingRaceTraits()).toEqual([]);
  });

  it("идентификаторы устойчивы: два прогона дают те же _id", () => {
    const first  = raceDocs().map(d => d.doc._id);
    const second = raceDocs().map(d => d.doc._id);

    expect(second).toEqual(first);
  });

  it("субрасы друкхари сохранили снимаемые Черты", () => {
    const wrack = byKey("subrace").get("wrack");

    expect(wrack.system.removesTraits).toEqual(SUBRACE_DATA.wrack.removesTraits ?? []);
  });
});
