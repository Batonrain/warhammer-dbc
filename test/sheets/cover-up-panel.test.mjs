// test/sheets/cover-up-panel.test.mjs
//
// Блок «ЯЧЕЙКИ АГЕНТОВ» (Cover Up) на вкладке СОЦИУМ: когда он есть, что
// показывает по таблице книги и как правится через флаг актора. Правила и
// таблица — test/rules/cover-up.test.mjs; здесь контекст листа и запись.

import "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  coverUpPanelContext, addCoverUpCell, changeCoverUpCell, removeCoverUpCell
} from "../../module/sheets/tabs/cover-up-panel.mjs";
import { COVER_UP_FLAG } from "../../module/rules/cover-up.mjs";

const NS = "warhammer-dbc";
const talent = { type: "talent", name: "Cover Up / Работа под Прикрытием", system: {} };

/** Актор-двойник: флаг читается как у документа, setFlag запоминает записанное и обновляет флаг. */
function fakeActor({ items = [talent], cells, inf, archetype = "", race = "human" } = {}) {
  const a = {
    items,
    system: { characteristics: { inf: { total: inf ?? 0 } }, archetype, race },
    flags: cells === undefined ? {} : { [NS]: { [COVER_UP_FLAG]: cells } },
    writes: [],
    async setFlag(scope, key, value) {
      this.writes.push([scope, key, value]);
      this.flags[scope] = { ...(this.flags[scope] ?? {}), [key]: value };
    }
  };
  return a;
}

describe("контекст блока", () => {
  it("без Таланта блока нет вовсе, даже если в флаге лежат ячейки", () => {
    const ctx = coverUpPanelContext(fakeActor({ items: [], cells: [{ name: "А", inf: 2 }] }));
    expect(ctx.hasCoverUp).toBe(false);
    expect(ctx.coverUpCells).toBeUndefined();
  });

  it("с Талантом и без ячеек — блок есть, список пуст, счётчики нули", () => {
    const ctx = coverUpPanelContext(fakeActor());
    expect(ctx.hasCoverUp).toBe(true);
    expect(ctx.coverUpCells).toEqual([]);
    expect([ctx.coverUpCount, ctx.coverUpTotalInf, ctx.coverUpMaxRequisition]).toEqual([0, 0, 0]);
  });

  it("строки считают Х-ки агентов и Уровень Реквизиции по таблице сами", () => {
    const ctx = coverUpPanelContext(fakeActor({
      cells: [{ name: "Тени Улья", inf: 1 }, { name: "Гильдия", inf: 4 }]
    }));
    const [a, b] = ctx.coverUpCells;
    expect(a).toMatchObject({ idx: 0, name: "Тени Улья", inf: 1, agents: 25, requisition: 0, free: false });
    expect(b).toMatchObject({ idx: 1, name: "Гильдия", inf: 4, agents: 40, requisition: 2 });
    expect(ctx.coverUpCount).toBe(2);
    expect(ctx.coverUpTotalInf).toBe(5);
    expect(ctx.coverUpMaxRequisition).toBe(2);
  });

  it("выпадающий список Inf — 1…4, выбран текущий", () => {
    const [row] = coverUpPanelContext(fakeActor({ cells: [{ name: "А", inf: 3 }] })).coverUpCells;
    expect(row.infOptions.map(o => o.value)).toEqual([1, 2, 3, 4]);
    expect(row.infOptions.filter(o => o.selected).map(o => o.value)).toEqual([3]);
  });
});

describe("Inf на листе минус вложено в ячейки — вычисляется, в актор не пишется", () => {
  it("платные ячейки уменьшают остаток, бесплатные нет; строка несёт галочку", () => {
    const a = fakeActor({ inf: 30, archetype: "renegade", cells: [
      { name: "Тени", inf: 3 }, { name: "Корсарская", inf: 2, free: true }, { name: "Гильдия", inf: 4 }] });
    const ctx = coverUpPanelContext(a);
    expect(ctx.coverUpCells.map(c => c.free)).toEqual([false, true, false]);
    expect(ctx).toMatchObject({ coverUpInfSheet: 30, coverUpPaidInf: 7, coverUpFreeInf: 2, coverUpInfLeft: 23, coverUpInfOver: false });
    expect(ctx.coverUpTotalInf).toBe(9);
  });
  it("перебор: вложено больше Inf с листа — остаток минус и флаг", () => {
    const ctx = coverUpPanelContext(fakeActor({ inf: 3, cells: [{ name: "А", inf: 4 }] }));
    expect(ctx).toMatchObject({ coverUpInfLeft: -1, coverUpInfOver: true });
  });
  it("галочка бесплатной ячейки уходит в флаг, и остаток после неё растёт", async () => {
    const a = fakeActor({ inf: 10, race: "azuriane", cells: [{ name: "А", inf: 4 }] });
    expect(coverUpPanelContext(a).coverUpInfLeft).toBe(6);
    await changeCoverUpCell(a, 0, { free: true });
    expect(a.flags[NS][COVER_UP_FLAG]).toEqual([{ name: "А", inf: 4, free: true }]);
    expect(coverUpPanelContext(a).coverUpInfLeft).toBe(10);
    expect(a.system.characteristics.inf.total).toBe(10);
  });
});

describe("галочка «бесплатная ячейка» — только Отступник и Аэльдари (решение владельца 08.11.2026)", () => {
  const cells = [{ name: "А", inf: 3, free: true }, { name: "Б", inf: 2 }];
  it("у обычного персонажа галочки нет, старая бесплатная ячейка считается платной", () => {
    const ctx = coverUpPanelContext(fakeActor({ inf: 20, cells }));
    expect(ctx.coverUpFreeAllowed).toBe(false);
    expect(ctx.coverUpCells.map(c => c.free)).toEqual([false, false]);
    expect(ctx).toMatchObject({ coverUpPaidInf: 5, coverUpFreeInf: 0, coverUpInfLeft: 15 });
  });
  it("Отступник и Аэльдари галочку получают, бесплатная ячейка остаток не уменьшает", () => {
    for (const over of [{ archetype: "renegade" }, { race: "drukhari" }]) {
      const ctx = coverUpPanelContext(fakeActor({ inf: 20, cells, ...over }));
      expect(ctx.coverUpFreeAllowed).toBe(true);
      expect(ctx.coverUpCells.map(c => c.free)).toEqual([true, false]);
      expect(ctx).toMatchObject({ coverUpPaidInf: 2, coverUpFreeInf: 3, coverUpInfLeft: 18 });
    }
  });
  it("правка free=true у не-Отступника/не-Аэльдари в флаг не пишется", async () => {
    const a = fakeActor({ inf: 10, cells: [{ name: "А", inf: 4 }] });
    await changeCoverUpCell(a, 0, { free: true });
    expect(a.flags[NS][COVER_UP_FLAG]).toEqual([{ name: "А", inf: 4, free: false }]);
    expect(coverUpPanelContext(a).coverUpInfLeft).toBe(6);
  });
  it("снять галочку у не-Отступника можно всегда", async () => {
    const a = fakeActor({ cells: [{ name: "А", inf: 4, free: true }] });
    await changeCoverUpCell(a, 0, { free: false });
    expect(a.flags[NS][COVER_UP_FLAG]).toEqual([{ name: "А", inf: 4, free: false }]);
  });
  it("разметка: колонка «Беспл.» и галочка показываются только при coverUpFreeAllowed", () => {
    const hbs = fs.readFileSync(path.resolve(import.meta.dirname, "../../templates/actor/parts/tab-social.hbs"), "utf8");
    const block = hbs.slice(hbs.indexOf('data-collapse-key="social-cover-up"'), hbs.indexOf("{{!-- ── Отношения ── --}}"));
    const guardRe = /\{\{#if (?:\.\.\/)?coverUpFreeAllowed\}\}[^\n]*?\{\{\/if\}\}/g;
    const guarded = [...block.matchAll(guardRe)].map(m => m[0]);
    expect(guarded.some(g => g.includes("cover-up-free"))).toBe(true);
    expect(guarded.some(g => g.includes("Беспл."))).toBe(true);
    expect(block.replace(guardRe, "")).not.toMatch(/cover-up-free|Беспл\./);
  });
});

describe("запись через флаг актора (без схемы)", () => {
  it("добавить: в флаг уходит весь список с новой ячейкой (Inf 1, пустое имя)", async () => {
    const a = fakeActor({ cells: [{ name: "А", inf: 2 }] });
    await addCoverUpCell(a);
    expect(a.writes).toEqual([[NS, COVER_UP_FLAG, [{ name: "А", inf: 2, free: false }, { name: "", inf: 1, free: false }]]]);
  });

  it("изменить имя и Inf: чужие ячейки целы, Inf вне 1…4 прижимается", async () => {
    const a = fakeActor({ cells: [{ name: "А", inf: 2 }, { name: "Б", inf: 3 }] });
    await changeCoverUpCell(a, 1, { name: "Бэ" });
    await changeCoverUpCell(a, 0, { inf: 9 });
    expect(a.flags[NS][COVER_UP_FLAG]).toEqual([{ name: "А", inf: 4, free: false }, { name: "Бэ", inf: 3, free: false }]);
  });

  it("удалить: ячейка уходит, остальные остаются", async () => {
    const a = fakeActor({ cells: [{ name: "А", inf: 1 }, { name: "Б", inf: 2 }] });
    await removeCoverUpCell(a, 0);
    expect(a.flags[NS][COVER_UP_FLAG]).toEqual([{ name: "Б", inf: 2, free: false }]);
  });

  it("несуществующий индекс ничего не пишет", async () => {
    const a = fakeActor({ cells: [{ name: "А", inf: 1 }] });
    await changeCoverUpCell(a, 5, { name: "x" });
    await removeCoverUpCell(a, 5);
    expect(a.writes).toEqual([]);
  });

  it("запись и чтение — круг: то, что записали, панель показывает же", async () => {
    const a = fakeActor();
    await addCoverUpCell(a);
    await changeCoverUpCell(a, 0, { name: "Сеть Ульев", inf: 3 });
    const [row] = coverUpPanelContext(a).coverUpCells;
    expect(row).toMatchObject({ name: "Сеть Ульев", inf: 3, agents: 35, requisition: 1 });
  });
});

describe("быстрые правки подряд не затирают друг друга (флаг обновляется после ответа сервера)", () => {
  /** Актор, у которого флаг меняется с задержкой, как на удалённом сервере. */
  function slowActor() {
    const a = fakeActor({ cells: [{ name: "А", inf: 1 }] });
    a.setFlag = async function (scope, key, value) {
      await new Promise(r => setTimeout(r, 15));
      this.flags[scope] = { ...(this.flags[scope] ?? {}), [key]: value };
    };
    return a;
  }
  it("переименование и сразу «+» — обе правки в итоговом списке", async () => {
    const a = slowActor();
    await Promise.all([changeCoverUpCell(a, 0, { name: "Переименована" }), addCoverUpCell(a)]);
    expect(a.flags[NS][COVER_UP_FLAG]).toEqual([{ name: "Переименована", inf: 1, free: false }, { name: "", inf: 1, free: false }]);
  });
  it("сбой одной записи не глушит следующие", async () => {
    const a = slowActor();
    const ok = a.setFlag;
    a.setFlag = async () => { throw new Error("сервер недоступен"); };
    await expect(addCoverUpCell(a)).rejects.toThrow();
    a.setFlag = ok;
    await addCoverUpCell(a);
    expect(a.flags[NS][COVER_UP_FLAG]).toHaveLength(2);
  });
});

describe("разметка вкладки СОЦИУМ", () => {
  it("кнопка ячейки не носит чужих классов с обработчиками (social-relation-* удаляет ОТНОШЕНИЯ)", () => {
    const hbs = fs.readFileSync(path.resolve(import.meta.dirname, "../../templates/actor/parts/tab-social.hbs"), "utf8");
    const block = hbs.slice(hbs.indexOf('data-collapse-key="social-cover-up"'), hbs.indexOf("{{!-- ── Отношения ── --}}"));
    expect(block).toContain("cover-up-remove");
    expect(block).not.toMatch(/social-relation/);
  });
  const hbs = fs.readFileSync(path.resolve(import.meta.dirname, "../../templates/actor/parts/tab-social.hbs"), "utf8");
  it("блок показывается только по hasCoverUp, сворачиваемый, с кнопками добавить/удалить и полями правки", () => {
    expect(hbs).toMatch(/\{\{#if hasCoverUp\}\}/);
    expect(hbs).toContain('data-collapse-key="social-cover-up"');
    expect(hbs).toContain('data-action="panelCollapse"');
    for (const cls of ["cover-up-add", "cover-up-remove", "cover-up-name", "cover-up-inf", "cover-up-free", "coverUpInfLeft"]) {
      expect(hbs, cls).toContain(cls);
    }
  });
  it("лист подключает контекст и слушатели блока", () => {
    const sheet = fs.readFileSync(path.resolve(import.meta.dirname, "../../module/sheets/actor-sheet.mjs"), "utf8");
    expect(sheet).toContain("coverUpPanelContext(this.actor)");
    expect(sheet).toContain("activateCoverUpPanelListeners(root, this.actor");
  });
});
