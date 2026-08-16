// test/sheets/horde-v2.test.mjs
//
// Лист Орды — первый переведённый на ApplicationV2 (wdbc-ff4.10.1) и образец
// для остальных девяти. Рендера здесь нет: Foundry в тестах не запускается,
// проверяется договор между листом и шаблоном — карта действий, вкладки и
// контекст. Само окно смотрится руками в Foundry, тест этого не заменяет.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerHordeSheet } from "../../module/sheets/horde-sheet.mjs";


/** Лист без Foundry: методам нужен только actor и пара полей приложения. */
function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerHordeSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "battle" } }, extra);
}

function hordeActor() {
  const items = [
    { id: "w1", name: "Автоган", img: "w.png", type: "weapon", system: { damage: "1d10+3" } },
    { id: "t1", name: "Ярость", img: "t.png", type: "trait",  system: { summary: "бьёт первым" } }
  ];
  items.filter = Array.prototype.filter.bind(items);
  return {
    name: "Орда culтистов", img: "h.png", items,
    system: {
      characteristics: { ws: { total: 35, bonus: 3, base: 30, advance: 5 } },
      derived: { state: "weakened", magDamageDice: 1 },
      magnitude: { value: 20, start: 40 }, psychDamage: 2
    }
  };
}

beforeEach(() => { globalThis.game.user.isGM = true; });

describeV2Sheet(WarhammerHordeSheet, {
  sheet: "module/sheets/horde-sheet.mjs",
  template: "templates/actor/horde-sheet.hbs"
});

// Блочный параметр цикла (`as |sk|`) лексический, и `../` к нему не применяется:
// с `../sk.rank` выбранный ранг терялся и КАЖДЫЙ навык показывался
// Нетренированным, хотя значение рядом стояло верное.
describe("селект ранга навыка", () => {
  const template = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../templates/actor/horde-sheet.hbs"), "utf8");

  it("сравнивает вариант с рангом самого навыка", () => {
    expect(template).toContain("(eq r.key sk.rank)");
    expect(template).not.toContain("../sk.rank");
  });
});

// ── Контекст ─────────────────────────────────────────────────────────────────
describe("_prepareContext", () => {
  it("даёт шаблону всё, что тот читает", async () => {
    const actor = hordeActor();
    const ctx = await WarhammerHordeSheet.prototype._prepareContext.call(sheetLike(actor), {});

    expect(ctx.actor).toBe(actor);
    expect(ctx.system).toBe(actor.system);
    expect(ctx.d).toBe(actor.system.derived);
    expect(ctx.tab).toBe("battle");
    expect(ctx.isGM).toBe(true);
    expect(ctx.stateLabel).toBe("Ослаблена потерями");
    expect(ctx.weapons).toEqual([{ id: "w1", name: "Автоган", img: "w.png", sys: { damage: "1d10+3" } }]);
    expect(ctx.talents.map(t => t.name)).toEqual(["Ярость"]);
    expect(ctx.chars.find(c => c.key === "ws")).toMatchObject({ total: 35, bonus: 3, base: 30, advance: 5 });
  });

  it("отдаёт Навыки со значением и список рангов для выпадающего списка", async () => {
    const actor = hordeActor();
    actor.system.skills = { dodge: { rank: "trained", total: 45 } };
    const ctx = await WarhammerHordeSheet.prototype._prepareContext.call(sheetLike(actor), {});

    // Все навыки, а не только заполненные: пустой берётся из умолчаний.
    expect(ctx.skills.find(s => s.key === "dodge"))
      .toEqual({ key: "dodge", label: "Уклонение", rank: "trained", total: 45 });
    expect(ctx.skills.find(s => s.key === "awareness"))
      .toEqual({ key: "awareness", label: "Бдительность", rank: "untrained", total: -20 });
    expect(ctx.skillRanks.map(r => r.key)).toContain("veteran");
  });

  it("вкладка берётся из умолчания, пока её не переключали", async () => {
    const ctx = await WarhammerHordeSheet.prototype._prepareContext
      .call(sheetLike(hordeActor(), { tabGroups: {} }), {});
    expect(ctx.tab).toBe("battle");
  });
});

// ── Права ────────────────────────────────────────────────────────────────────
// У V1 весь блок activateListeners стоял под if (!this.isEditable) return —
// на листе только для чтения кнопки не делали ничего.
describe("лист только для чтения", () => {
  const actions = WarhammerHordeSheet.DEFAULT_OPTIONS.actions;

  it("правящие действия не срабатывают", () => {
    const called = [];
    const sheet = sheetLike(null, {
      isEditable: false,
      _magReset: () => called.push("reset"),
      _createItem: () => called.push("create")
    });
    actions.mag.call(sheet, {}, { dataset: { mag: "reset" } });
    actions.itemCreate.call(sheet, {}, { dataset: { type: "weapon" } });
    expect(called).toEqual([]);
  });

  it("вкладки переключаются и на нём", () => {
    const switched = [];
    const sheet = sheetLike(null, { isEditable: false, changeTab: (t, g) => switched.push([t, g]) });
    actions.tab.call(sheet, {}, { dataset: { tab: "rules", group: "primary" } });
    expect(switched).toEqual([["rules", "primary"]]);
  });
});

// ── Магнитуда ────────────────────────────────────────────────────────────────
describe("кнопки Магнитуды", () => {
  const mag = WarhammerHordeSheet.DEFAULT_OPTIONS.actions.mag;
  const run = (kind, event = {}) => {
    const calls = [];
    const sheet = sheetLike(null, {
      _magChange: (a, b) => calls.push([a, b]),
      _magReset: () => calls.push("reset")
    });
    mag.call(sheet, event, { dataset: { mag: kind } });
    return calls[0];
  };

  it("урон и лечение ходят на 1, с Shift — на 5", () => {
    expect(run("dmg")).toEqual([-1, 0]);
    expect(run("heal")).toEqual([1, 0]);
    expect(run("dmg", { shiftKey: true })).toEqual([-5, 0]);
    expect(run("heal", { ctrlKey: true })).toEqual([5, 0]);
  });

  it("психологический урон снимает Магнитуду и копится, лечение — наоборот", () => {
    expect(run("psych")).toEqual([-1, 1]);
    expect(run("psychheal")).toEqual([1, -1]);
  });

  it("сброс идёт своим путём", () => {
    expect(run("reset")).toBe("reset");
  });
});
