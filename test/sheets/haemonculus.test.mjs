// test/sheets/haemonculus.test.mjs
//
// Вкладка Гемункула (Haemonculus Coven, «Идеалы») — первая подсистема, которую
// шаг 5.3 выносит из листа персонажа. Тест написан ДО выноса и на выносе не
// менялся, кроме одной строки — точки вызова: сначала метод листа, потом
// функция модуля. Совпадение ожиданий до и после и есть доказательство, что
// переезд ничего не поменял.
//
// Считается всё из actor.system и таблиц constants/haemonculus.mjs, поэтому
// заглушка Foundry в результат не входит — она нужна только на загрузку листа.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { haemonculusContext } from "../../module/sheets/tabs/haemonculus.mjs";

/** Гемункул со Стадией 4: открыты обе таблицы Идеалов. */
function haemActor({ stage = 4, intBonus = 8, splitPools = false, flesh = [], warp = [] } = {}) {
  return {
    system: {
      eliteArchetype: "Гемункул",
      characteristics: { int: { bonus: intBonus } },
      haemonculus: { stage, splitPools, flesh, warp }
    }
  };
}

describe("вкладка Гемункула", () => {

  it("лестница ступеней открыта по текущую и помечает текущую", () => {
    const { ladder } = haemonculusContext(haemActor({ stage: 4 }));

    expect(ladder).toHaveLength(6);
    expect(ladder.map(s => s.open)).toEqual([true, true, true, true, true, false]);
    expect(ladder.filter(s => s.isCurrent).map(s => s.stage)).toEqual([4]);
    // Нулевая ступень — вход в Ковен, её цена в лестнице не показывается.
    expect(ladder[0].cost).toBe(0);
    expect(ladder[4].cost).toBe(1500);
  });

  it("общий пул складывает траты обеих таблиц", () => {
    // Укус (2 + 1 за рейтинг) с тремя рейтингами = 4, Демонический (5 + 3) = 8.
    const ctx = haemonculusContext(haemActor({
      intBonus: 8,
      flesh: [{ key: "bite", ranks: 3 }],
      warp:  [{ key: "daemonic", ranks: 2 }]
    }));

    expect(ctx.budgets).toEqual([
      { label: "Общий пул", cap: 8, spent: 12, over: true, pct: 100 }
    ]);
  });

  it("раздельные пулы считают Плоть и Варп по своим бюджетам", () => {
    const ctx = haemonculusContext(haemActor({
      intBonus: 8, splitPools: true,
      flesh: [{ key: "bite", ranks: 3 }],
      warp:  [{ key: "daemonic", ranks: 2 }]
    }));

    expect(ctx.budgets).toEqual([
      { label: "Идеал Плоти", cap: 8, spent: 4, over: false, pct: 50 },
      { label: "Идеал Варпа", cap: 8, spent: 8, over: false, pct: 100 }
    ]);
  });

  it("взятый трейт несёт свои рейтинги и цену, невзятый — нули", () => {
    const ctx = haemonculusContext(haemActor({ flesh: [{ key: "bite", ranks: 3 }] }));
    const fleshRows = ctx.tables.find(t => t.kind === "flesh").rows;

    expect(fleshRows.find(r => r.key === "bite"))
      .toMatchObject({ taken: true, ranks: 3, cost: 4 });
    expect(fleshRows.find(r => r.key === "amorphous"))
      .toMatchObject({ taken: false, ranks: 0, cost: 0 });
  });

  it("трейты Варпа без Порчи помечены", () => {
    const warpRows = haemonculusContext(haemActor()).tables.find(t => t.kind === "warp").rows;

    expect(warpRows.find(r => r.key === "blunted").noCor).toBe(true);
    expect(warpRows.find(r => r.key === "daemonic").noCor).toBe(false);
  });

  it("до Стадии 1 таблиц нет вовсе", () => {
    const ctx = haemonculusContext(haemActor({ stage: 0 }));

    expect(ctx.anyTable).toBe(false);
    expect(ctx.tables.map(t => t.open)).toEqual([false, false]);
  });
});
