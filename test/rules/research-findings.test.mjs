// test/rules/research-findings.test.mjs
//
// Итог проекта-Исследования (книга — глава «Исследование», стр. 21-22):
// предмет-знание для Чертежа/Истинного имени/Иного и Психосилы/Ритуала/Вязи,
// но НЕ для «Изучения» (Logic «вместо создания знаний») — только запись в
// Журнале. Чистая логика — module/apps/craft-workshop.mjs вызывает это на
// исходе смены и сам решает, что делать с актором.

import { describe, it, expect } from "vitest";
import {
  researchFindingItemData, researchJournalEntry, appendResearchJournal,
  researchKindLabel, PSYCHIC_RESULT_TYPES, RESEARCH_JOURNAL_FLAG
} from "../../module/rules/research-findings.mjs";

describe("researchFindingItemData", () => {
  it("Чертёж — предмет gear с названием проекта", () => {
    const data = researchFindingItemData({ kind: "blueprint", title: "Автомельта Mk.VII" });
    expect(data).toEqual({
      name: "Автомельта Mk.VII", type: "gear",
      system: { description: "<p>Чертёж, открыт(о) Исследованием.</p>", gearCategory: "misc" }
    });
  });

  it("Чертёж без названия — подставляется родовое имя по виду находки", () => {
    const data = researchFindingItemData({ kind: "truename", title: "" });
    expect(data.name).toBe("Истинное имя");
    expect(data.type).toBe("gear");
  });

  it("Иное — тоже gear, родовое имя «Находка»", () => {
    const data = researchFindingItemData({ kind: "other", title: "" });
    expect(data.name).toBe("Находка");
  });

  it("Психосила/ритуал/вязь по умолчанию — psychicPower (первый в PSYCHIC_RESULT_TYPES)", () => {
    const data = researchFindingItemData({ kind: "psychic", title: "Пламенный Коготь" });
    expect(data.type).toBe(PSYCHIC_RESULT_TYPES[0].itemType);
    expect(data.name).toBe("Пламенный Коготь");
    expect(data.system.description).toMatch(/Опыт/);
  });

  it("Психосила: выбран resultType=ritual — тип ritual, заполнено source", () => {
    const data = researchFindingItemData({ kind: "psychic", resultType: "ritual", title: "Ритуал Теней" });
    expect(data.type).toBe("ritual");
    expect(data.system.source).toBe("Исследование");
  });

  it("Психосила: выбран resultType=runicWeave — тип runicWeave, без source (поля нет у схемы)", () => {
    const data = researchFindingItemData({ kind: "psychic", resultType: "runicWeave", title: "Вязь Молчания" });
    expect(data.type).toBe("runicWeave");
    expect(data.system.source).toBeUndefined();
  });

  it("Изучение — null, книга противопоставляет его созданию знания", () => {
    expect(researchFindingItemData({ kind: "lore", title: "что угодно" })).toBeNull();
  });
});

describe("researchKindLabel", () => {
  it("известные виды находки — книжная подпись", () => {
    expect(researchKindLabel("blueprint")).toContain("Чертёж");
    expect(researchKindLabel("lore")).toContain("Изучение");
  });
  it("незнакомый ключ — возвращается как есть, не падает", () => {
    expect(researchKindLabel("xyz")).toBe("xyz");
    expect(researchKindLabel()).toBe("");
  });
});

describe("researchJournalEntry", () => {
  it("Чертёж — studyTarget не попадает в запись, даже если передан", () => {
    const e = researchJournalEntry({ kind: "blueprint", title: "T", skillLabel: "Tech-Use",
      studyTarget: "мимо", itemId: "it1", itemName: "T" });
    expect(e.studyTarget).toBe("");
    expect(e.itemId).toBe("it1");
    expect(e.kindLabel).toBe(researchKindLabel("blueprint"));
  });

  it("Изучение — studyTarget сохраняется, itemId остаётся null", () => {
    const e = researchJournalEntry({ kind: "lore", skillLabel: "Логика",
      studyTarget: "Scholastic Lore (Xenos)" });
    expect(e.studyTarget).toBe("Scholastic Lore (Xenos)");
    expect(e.itemId).toBeNull();
  });
});

describe("appendResearchJournal", () => {
  it("добавляет запись к пустому/неправильному журналу", () => {
    expect(appendResearchJournal(null, { a: 1 })).toEqual([{ a: 1 }]);
    expect(appendResearchJournal(undefined, { a: 1 })).toEqual([{ a: 1 }]);
  });

  it("капа — хранит только последние N записей", () => {
    const log = Array.from({ length: 5 }, (_, i) => ({ i }));
    const out = appendResearchJournal(log, { i: 5 }, 3);
    expect(out).toEqual([{ i: 3 }, { i: 4 }, { i: 5 }]);
  });
});

describe("RESEARCH_JOURNAL_FLAG", () => {
  it("имя флага стабильно (другие модули читают его по строке)", () => {
    expect(RESEARCH_JOURNAL_FLAG).toBe("researchJournal");
  });
});
