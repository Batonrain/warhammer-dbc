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
  COVER_UP_TABLE, COVER_UP_FLAG,
  hasCoverUp, readCells, cellStats, coverUpSummary, clampInf, infOnSheet, infRemaining,
  freeCellAllowed, effectiveCells,
  withAddedCell, withChangedCell, withoutCell
} from "../../module/rules/cover-up.mjs";
import { packDocuments, PACKS_SRC, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (items = [], cells) => ({
  items,
  flags: cells === undefined ? {} : { "warhammer-dbc": { [COVER_UP_FLAG]: cells } }
});

describe("таблица ячейки (книга, Cover Up)", () => {
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
      { name: "Гильдия", inf: 3, free: false },
      { name: "", inf: 4, free: false },
      { name: "5", inf: 2, free: false }
    ]);
  });
  it("галочка «бесплатная ячейка»: только настоящее true, у старых записей без поля — не бесплатная", () => {
    const cells = readCells(actorWith([], [{ name: "А", inf: 2, free: true }, { name: "Б", inf: 2 }, { name: "В", inf: 2, free: "yes" }]));
    expect(cells.map(c => c.free)).toEqual([true, false, false]);
  });
});

describe("правка списка — чистые функции, исходный список не меняют", () => {
  const base = [{ name: "А", inf: 1, free: false }, { name: "Б", inf: 4, free: false }];
  it("добавить: новая ячейка в конце, по умолчанию Inf 1, пустое имя, платная", () => {
    const next = withAddedCell(base);
    expect(next).toEqual([...base, { name: "", inf: 1, free: false }]);
    expect(base).toHaveLength(2);
  });
  it("добавить с именем и Inf", () => {
    expect(withAddedCell([], { name: "Сеть Ульев", inf: 3 })).toEqual([{ name: "Сеть Ульев", inf: 3, free: false }]);
  });
  it("изменить имя и Inf по индексу; несуществующий индекс — без изменений", () => {
    expect(withChangedCell(base, 0, { name: "Новая" })[0]).toEqual({ name: "Новая", inf: 1, free: false });
    expect(withChangedCell(base, 1, { inf: 2 })[1]).toEqual({ name: "Б", inf: 2, free: false });
    expect(withChangedCell(base, 1, { inf: 77 })[1].inf).toBe(4);
    expect(withChangedCell(base, 5, { name: "x" })).toEqual(base);
    expect(base[0]).toEqual({ name: "А", inf: 1, free: false });
  });
  it("галочка «бесплатная»: ставится и снимается, остальное в ячейке цело", () => {
    const on = withChangedCell(base, 1, { free: true });
    expect(on[1]).toEqual({ name: "Б", inf: 4, free: true });
    expect(withChangedCell(on, 1, { free: false })[1].free).toBe(false);
    expect(base[1].free).toBe(false);
  });
  it("удалить по индексу; несуществующий индекс — без изменений", () => {
    expect(withoutCell(base, 0)).toEqual([{ name: "Б", inf: 4, free: false }]);
    expect(withoutCell(base, 9)).toEqual(base);
  });
});

describe("сводка ведомости", () => {
  it("число ячеек, вложенный Inf (всего и платный) и высший Уровень Реквизиции", () => {
    const s = coverUpSummary([{ name: "А", inf: 1 }, { name: "Б", inf: 4 }, { name: "В", inf: 3 }]);
    expect(s).toEqual({ count: 3, totalInf: 8, paidInf: 8, freeInf: 0, maxRequisition: 2 });
  });
  it("бесплатные ячейки в платный Inf не входят", () => {
    const s = coverUpSummary([{ name: "А", inf: 2, free: true }, { name: "Б", inf: 4 }, { name: "В", inf: 3, free: true }]);
    expect(s).toEqual({ count: 3, totalInf: 9, paidInf: 4, freeInf: 5, maxRequisition: 2 });
  });
  it("пусто — нули", () => {
    expect(coverUpSummary([])).toEqual({ count: 0, totalInf: 0, paidInf: 0, freeInf: 0, maxRequisition: 0 });
  });
});

describe("Inf на листе минус вложено в ячейки (решение владельца 07.11.2026) — показ, не запись", () => {
  const sheetActor = total => ({ system: { characteristics: { inf: { total } } } });
  it("infOnSheet читает итог Inf с листа; нет данных — 0", () => {
    expect(infOnSheet(sheetActor(42))).toBe(42);
    expect(infOnSheet(sheetActor("17"))).toBe(17);
    expect(infOnSheet({})).toBe(0);
    expect(infOnSheet(null)).toBe(0);
  });
  it("остаток = Inf листа минус платные ячейки; бесплатные его не уменьшают", () => {
    const cells = [{ name: "А", inf: 3 }, { name: "Б", inf: 2, free: true }, { name: "В", inf: 4 }];
    const renegade = { system: { archetype: "renegade", characteristics: { inf: { total: 40 } } } };
    expect(infRemaining(renegade, cells)).toEqual({ onSheet: 40, paid: 7, left: 33, over: false });
  });
  it("вложили больше, чем есть, — остаток отрицательный и помечен перебором", () => {
    expect(infRemaining(sheetActor(5), [{ name: "А", inf: 4 }, { name: "Б", inf: 3 }])).toEqual({ onSheet: 5, paid: 7, left: -2, over: true });
  });
  it("характеристику актора не трогает", () => {
    const a = sheetActor(30);
    infRemaining(a, [{ name: "А", inf: 4 }]);
    expect(a.system.characteristics.inf.total).toBe(30);
  });
});

describe("бесплатная ячейка — только Отступник и Аэльдари (решение владельца 08.11.2026)", () => {
  const who = (archetype, race = "human") => ({ system: { archetype, race, characteristics: { inf: { total: 30 } } } });
  it("Отступник: по ключу и по имени архетипа, любой регистр", () => {
    for (const a of ["renegade", "Renegade", "ренегат", " Ренегат ", "отступник"]) expect(freeCellAllowed(who(a)), a).toBe(true);
  });
  it("Аэльдари: любая раса группы", () => {
    for (const r of ["azuriane", "drukhari", "ynnari", "halfEldar", "harlequin", "exodite"]) expect(freeCellAllowed(who("", r)), r).toBe(true);
  });
  it("остальные — нет: другие архетипы и расы, пустой и отсутствующий актор", () => {
    expect(freeCellAllowed(who("pirate"))).toBe(false);
    expect(freeCellAllowed(who("renegadePsyker"))).toBe(false);
    expect(freeCellAllowed(who("", "astartes"))).toBe(false);
    expect(freeCellAllowed({})).toBe(false);
    expect(freeCellAllowed(null)).toBe(false);
  });
  it("effectiveCells: у не-Отступника free сбрасывается, у Отступника сохраняется", () => {
    const cells = [{ name: "А", inf: 2, free: true }, { name: "Б", inf: 1, free: false }];
    expect(effectiveCells(who("pirate"), cells).map(c => c.free)).toEqual([false, false]);
    expect(effectiveCells(who("renegade"), cells).map(c => c.free)).toEqual([true, false]);
    expect(cells[0].free).toBe(true);
  });
  it("infRemaining: старая ячейка с free у не-Отступника платная, у Отступника — нет", () => {
    const cells = [{ name: "А", inf: 4, free: true }, { name: "Б", inf: 2 }];
    expect(infRemaining(who("pirate"), cells)).toEqual({ onSheet: 30, paid: 6, left: 24, over: false });
    expect(infRemaining(who("renegade"), cells)).toEqual({ onSheet: 30, paid: 2, left: 28, over: false });
    expect(infRemaining(who("", "azuriane"), cells)).toEqual({ onSheet: 30, paid: 2, left: 28, over: false });
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
