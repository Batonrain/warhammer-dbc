// test/rules/simultaneous-action.test.mjs
//
// wdbc-1rno.27/.37: очерёдность одновременных действий (core.json, врезка
// у «Задержка») — сравнение Ag (или P при Vigilance у реагирующего
// стрелка), тай-брейк по текущей Инициативе в трекере боя.

import { describe, it, expect } from "vitest";
import { simultaneousActionWinner, reactingOrderCharTotal } from "../../module/rules/simultaneous-action.mjs";

describe("simultaneousActionWinner", () => {
  it("выше характеристика у реагирующего — reacting", () => {
    expect(simultaneousActionWinner({ actingCharTotal: 30, reactingCharTotal: 40 })).toBe("reacting");
  });
  it("выше характеристика у действующего — acting", () => {
    expect(simultaneousActionWinner({ actingCharTotal: 40, reactingCharTotal: 30 })).toBe("acting");
  });
  it("равные характеристики — тай-брейк по Инициативе реагирующего", () => {
    expect(simultaneousActionWinner({
      actingCharTotal: 30, reactingCharTotal: 30, actingInitiative: 10, reactingInitiative: 15
    })).toBe("reacting");
  });
  it("равные характеристики и равная Инициатива — действующий (по умолчанию)", () => {
    expect(simultaneousActionWinner({
      actingCharTotal: 30, reactingCharTotal: 30, actingInitiative: 10, reactingInitiative: 10
    })).toBe("acting");
  });
  it("пустой вызов — не бросает, отдаёт acting", () => {
    expect(simultaneousActionWinner()).toBe("acting");
  });
});

describe("reactingOrderCharTotal", () => {
  const chars = { ag: { total: 30 }, per: { total: 45 } };
  it("без Vigilance — только Ag, даже если P выше", () => {
    expect(reactingOrderCharTotal(chars, false, true)).toBe(30);
  });
  it("с Vigilance, но реакция не стрельба — только Ag", () => {
    expect(reactingOrderCharTotal(chars, true, false)).toBe(30);
  });
  it("с Vigilance и реакция — стрельба — берётся большее (P)", () => {
    expect(reactingOrderCharTotal(chars, true, true)).toBe(45);
  });
  it("Vigilance при P ниже Ag — всё равно берётся большее (Ag)", () => {
    expect(reactingOrderCharTotal({ ag: { total: 50 }, per: { total: 20 } }, true, true)).toBe(50);
  });
});
