// test/rules/cover-up.test.mjs
//
// Талант «Cover Up / Работа под Прикрытием» (Основная книга, Социальные,
// решение владельца 26.10.2026): ведомость ячеек тайных агентов на вкладке
// СОЦИУМ. Книга: «Персонаж может потратить следующее число Inf (Характеристики,
// не Очков), чтобы организовать … группу тайных агентов»; таблица
// Inf 1 → 25 / 0, Inf 2 → 30 / 1, Inf 3 → 35 / 1, Inf 4 → 40 / 2.
//
// Чистая логика — без Foundry. Таблица сверяется с книгой и с текстом Таланта
// в паке (AGENTS.md → «Тесты»: фикстуры — не замена настоящим данным).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  COVER_UP_TABLE, COVER_UP_INF_MIN, COVER_UP_INF_MAX, COVER_UP_FLAG,
  hasCoverUp, readCells, cellStats, coverUpSummary, clampInf,
  withAddedCell, withChangedCell, withoutCell
} from "../../module/rules/cover-up.mjs";
import { packDocuments, PACKS_SRC, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (items = [], cells) => ({
  items,
  flags: cells === undefined ? {} : { "warhammer-dbc": { [COVER_UP_FLAG]: cells } }
});

describe("таблица ячейки (книга, Cover Up)", () => {
  it("Inf 1–4 → средние Х-ки агентов и Уровень Реквизиции дословно по книге", () => {
    expect(COVER_UP_TABLE).toEqual({
      1: { agents: 25, requisition: 0 },
      2: { agents: 30, requisition: 1 },
      3: { agents: 35, requisition: 1 },
      4: { agents: 40, requisition: 2 }
    });
    expect([COVER_UP_INF_MIN, COVER_UP_INF_MAX]).toEqual([1, 4]);
  });
  it("cellStats: числа считаются по таблице, вне таблицы — null", () => {
    expect(cellStats(1)).toEqual({ agents: 25, requisition: 0 });
    expect(cellStats("3")).toEqual({ agents: 35, requisition: 1 });
    expect(cellStats(4)).toEqual({ agents: 40, requisition: 2 });
    expect(cellStats(0)).toBeNull();
    expect(cellStats(5)).toBeNull();
    expect(cellStats("x")).toBeNull();
    expect(cellStats(undefined)).toBeNull();
  });
  it("clampInf: целое в 1…4, мусор — нижняя граница", () => {
    expect(clampInf(2.6)).toBe(3);
    expect(clampInf(-3)).toBe(1);
    expect(clampInf(99)).toBe(4);
    expect(clampInf("abc")).toBe(1);
    expect(clampInf(undefined)).toBe(1);
  });
});

describe("кто видит ведомость (hasCoverUp)", () => {
  it("носитель Таланта — имя двуязычное, как в паке (itemHasName ищет английскую половину)", () => {
    expect(hasCoverUp(actorWith([talent("Cover Up / Работа под Прикрытием")]))).toBe(true);
    expect(hasCoverUp(actorWith([talent("Cover Up")]))).toBe(true);
  });
  it("без Таланта, с чужим именем и с предметом другого типа — нет", () => {
    expect(hasCoverUp(actorWith([]))).toBe(false);
    expect(hasCoverUp(actorWith([talent("Cover Fire"), talent("Contact Network / Сеть Контактов")]))).toBe(false);
    expect(hasCoverUp(actorWith([{ type: "trait", name: "Cover Up / Работа под Прикрытием", system: {} }]))).toBe(false);
    expect(hasCoverUp(null)).toBe(false);
  });
  it("ячейки без Таланта не пропадают из флага, но панель их не показывает — решает hasCoverUp", () => {
    const a = actorWith([], [{ name: "Старая", inf: 2 }]);
    expect(hasCoverUp(a)).toBe(false);
    expect(readCells(a)).toHaveLength(1);
  });
});

describe("чтение ячеек из флага", () => {
  it("нет флага или не список — пустой список", () => {
    expect(readCells(actorWith([]))).toEqual([]);
    expect(readCells(actorWith([], "мусор"))).toEqual([]);
    expect(readCells(actorWith([], { a: 1 }))).toEqual([]);
    expect(readCells(null)).toEqual([]);
  });
  it("запись приводится к {name, inf}: пустое имя остаётся пустым, Inf прижимается к 1…4", () => {
    const cells = readCells(actorWith([], [{ name: "Гильдия", inf: 3 }, { inf: 9 }, null, "x", { name: 5, inf: "2" }]));
    expect(cells).toEqual([
      { name: "Гильдия", inf: 3 },
      { name: "", inf: 4 },
      { name: "5", inf: 2 }
    ]);
  });
});

describe("правка списка — чистые функции, исходный список не меняют", () => {
  const base = [{ name: "А", inf: 1 }, { name: "Б", inf: 4 }];
  it("добавить: новая ячейка в конце, по умолчанию Inf 1 и пустое имя", () => {
    const next = withAddedCell(base);
    expect(next).toEqual([...base, { name: "", inf: 1 }]);
    expect(base).toHaveLength(2);
  });
  it("добавить с именем и Inf", () => {
    expect(withAddedCell([], { name: "Сеть Ульев", inf: 3 })).toEqual([{ name: "Сеть Ульев", inf: 3 }]);
  });
  it("изменить имя и Inf по индексу; несуществующий индекс — без изменений", () => {
    expect(withChangedCell(base, 0, { name: "Новая" })[0]).toEqual({ name: "Новая", inf: 1 });
    expect(withChangedCell(base, 1, { inf: 2 })[1]).toEqual({ name: "Б", inf: 2 });
    expect(withChangedCell(base, 1, { inf: 77 })[1].inf).toBe(4);
    expect(withChangedCell(base, 5, { name: "x" })).toEqual(base);
    expect(base[0]).toEqual({ name: "А", inf: 1 });
  });
  it("удалить по индексу; несуществующий индекс — без изменений", () => {
    expect(withoutCell(base, 0)).toEqual([{ name: "Б", inf: 4 }]);
    expect(withoutCell(base, 9)).toEqual(base);
  });
});

describe("сводка ведомости", () => {
  it("число ячеек, вложенный Inf и Уровни Реквизиции — справочно", () => {
    const s = coverUpSummary([{ name: "А", inf: 1 }, { name: "Б", inf: 4 }, { name: "В", inf: 3 }]);
    expect(s).toEqual({ count: 3, totalInf: 8, maxRequisition: 2 });
  });
  it("пусто — нули", () => {
    expect(coverUpSummary([])).toEqual({ count: 0, totalInf: 0, maxRequisition: 0 });
  });
});

describe("Уровень Реквизиции — справочный (решение владельца 26.10.2026)", () => {
  it("тест Реквизиции и её Таланты ячеек не читают", () => {
    const root = path.resolve(import.meta.dirname, "../..");
    for (const f of ["module/rules/requisition.mjs", "module/rules/requisition-talents.mjs", "module/apps/requisition.mjs"]) {
      const text = fs.readFileSync(path.join(root, f), "utf8");
      expect(text, f).not.toMatch(/cover-up|coverUp|COVER_UP/);
    }
  });
});

describe("таблица против книги и Таланта в паке", () => {
  it("Основная книга: таблица Cover Up совпадает с COVER_UP_TABLE", () => {
    const book = JSON.parse(fs.readFileSync(path.join(PACKS_SRC, "books", "core.json"), "utf8"));
    const found = [];
    const walk = n => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === "object") {
        if (typeof n.html === "string" && n.html.includes("Cover Up /Работа под Прикрытием</h3>")) found.push(n.html);
        for (const k of Object.keys(n)) walk(n[k]);
      }
    };
    walk(book);
    expect(found.length).toBeGreaterThan(0);
    const after = found[0].split("Cover Up /Работа под Прикрытием</h3>")[1];
    const table = after.match(/<table[\s\S]*?<\/table>/)[0];
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)]
      .map(r => [...r[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => Number(c[1].replace(/<[^>]+>/g, "").trim())))
      .filter(r => r.length === 3);
    expect(rows).toHaveLength(4);
    expect(Object.fromEntries(rows.map(([inf, agents, requisition]) => [inf, { agents, requisition }])))
      .toEqual(COVER_UP_TABLE);
  });

  it("текст Таланта в паке даёт те же числа («Inf 1 → … 25, … 0; Inf 2 → 30/1; …»)", () => {
    const docs = packDocuments("talents", "talent").map(d => d.doc).filter(t => hasCoverUp({ items: [t] }));
    expect(docs).toHaveLength(1);
    const benefit = docs[0].system.benefit;
    const m = [...benefit.matchAll(/Inf (\d) → (?:ср\. Х-ки агентов )?(\d+)(?:, Уровень Реквизиции |\/)(\d)/g)]
      .map(x => [Number(x[1]), Number(x[2]), Number(x[3])]);
    expect(m).toHaveLength(4);
    expect(Object.fromEntries(m.map(([inf, agents, requisition]) => [inf, { agents, requisition }])))
      .toEqual(COVER_UP_TABLE);
  }, PACK_SCAN_TIMEOUT);
});
