// test/tools/ritual-reqs.test.mjs
//
// Разбор строки «Требования:» из книги в группы требований предмета-Ритуала
// (wdbc-c63). Строки взяты из packs-src/books/core.json как есть.
//
// Выгрузка главы «Мистика» — сырая, в две колонки вперемешку: текст соседней
// колонки влезает в середину требований, а заголовки соседних ритуалов
// склеиваются. Поэтому разбор СТРОГИЙ: любое неузнанное слово отменяет весь
// блок. Лучше оставить требования пустыми, чем повесить на ритуал чужие —
// пустые видно в отчёте, а чужие молча запретят ритуал тому, кому он положен.

import { describe, it, expect } from "vitest";
import { parseRequirements, blockRequirementText } from "../../tools/ritual-reqs.mjs";

const kinds = res => res.groups.map(g => [g.operator, ...g.entries.map(e => `${e.skillKey}:${e.specKey}:${e.rank}`)]);

describe("разбор требований", () => {
  it("один навык со специализацией", () => {
    const res = parseRequirements("Scholastic Lore (Occult) +10.");

    expect(res.record).toBe(null);
    expect(kinds(res)).toEqual([["AND", "scholasticLore:occult:trained"]]);
    expect(res.groups[0].entries[0].skillScope).toBe("group");
  });

  // «или» внутри одной записи — это ИЛИ-группа: хватает любого из вариантов.
  it("Запись отделяется, «или» собирается в ИЛИ-группу", () => {
    const res = parseRequirements("Запись (2), Forbidden Lore (Heresy) +10 или Forbidden Lore (Warp) +10.");

    expect(res.record).toBe(2);
    expect(kinds(res)).toEqual([["OR", "forbiddenLore:heresy:trained", "forbiddenLore:warp:trained"]]);
  });

  it("несколько требований — несколько И-групп, между ними И", () => {
    const res = parseRequirements("Запись (1), Medicae +0, Forbidden Lore (Warp) +10.");

    expect(res.record).toBe(1);
    expect(kinds(res)).toEqual([["AND", "medicae::knows"], ["AND", "forbiddenLore:warp:trained"]]);
    expect(res.groups[0].entries[0].skillScope).toBe("plain");
  });

  it("ступени +0/+10/+20/+30 — Знает, Тренированное, Опытный, Ветеран", () => {
    const ranks = ["+0", "+10", "+20", "+30"].map(p =>
      parseRequirements(`Scholastic Lore (Occult) ${p}.`).groups[0].entries[0].rank);

    expect(ranks).toEqual(["knows", "trained", "veteran", "expert"]);
  });

  // Ниже — то, из-за чего разбор строгий.
  it("текст соседней колонки внутри требований отменяет блок", () => {
    const junk = "Forbidden Lore (Daemons) +0 или Forbidden Lore (Heresy) проводится "
               + "только из отчаянья, или для использования демонов в других +10.";

    expect(parseRequirements(junk)).toBe(null);
  });

  it("нечисловая Запись (Х) и незнакомые требования отменяют блок", () => {
    expect(parseRequirements("Запись (Х), Scholastic Lore (Occult) +30.")).toBe(null);
    expect(parseRequirements("Запись (4), Cor 60, Forbidden Lore (Heresy) +30.")).toBe(null);
    expect(parseRequirements("Запись (3), Тех-Ассасин, Tech-Use +20.")).toBe(null);
  });

  it("незнакомый навык или специализация отменяют блок", () => {
    expect(parseRequirements("Выдуманное Знание (Occult) +10.")).toBe(null);
    expect(parseRequirements("Scholastic Lore (Выдумка) +10.")).toBe(null);
  });
});

describe("выделение блока требований", () => {
  const body = "Проза ритуала. Требования: Scholastic Lore (Occult) +10. Ассистенты: Нет. "
             + "Ритуал: описание процесса.";

  it("берётся текст между Требованиями и Ассистентами", () => {
    expect(blockRequirementText(body)).toBe("Scholastic Lore (Occult) +10.");
  });

  // Два «Требования:» в одном блоке — верный признак, что в него затесался
  // соседний ритуал: колонки в выгрузке идут вперемешку.
  it("два блока требований подряд — признак склейки, отказ", () => {
    expect(blockRequirementText(body + " Требования: Medicae +0. Ассистенты: Нет.")).toBe(null);
    expect(blockRequirementText("Проза без требований вовсе.")).toBe(null);
  });
});
