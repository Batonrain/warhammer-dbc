// test/rules/supply-timer.test.mjs
//
// Общий примитив «расходуемый по игровому времени ресурс на предмете»
// (wdbc-jtqf) — module/rules/supply-timer.mjs. Только сам примитив; Void-
// специфика (запас воздуха, breached) проверяется отдельно в void-air.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  supplyRemaining, isSupplyStarted, supplyStartedAt,
  startSupplyTimer, stopSupplyTimer
} from "../../module/rules/supply-timer.mjs";

function docWithFlags() {
  const store = {};
  return {
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; }
  };
}

describe("supplyRemaining", () => {
  it("таймер не запущен — весь запас цел", () => {
    expect(supplyRemaining(null, 100000, 3600)).toBe(3600);
  });

  it("только что запущен — весь запас цел", () => {
    expect(supplyRemaining(100000, 100000, 3600)).toBe(3600);
  });

  it("частично израсходован", () => {
    expect(supplyRemaining(100000 - 1800, 100000, 3600)).toBe(1800);
  });

  it("израсходован полностью — не уходит в минус", () => {
    expect(supplyRemaining(100000 - 7200, 100000, 3600)).toBe(0);
  });

  it("Infinity — безлимит независимо от startedAt", () => {
    expect(supplyRemaining(100000 - 999999, 100000, Infinity)).toBe(Infinity);
    expect(supplyRemaining(null, 100000, Infinity)).toBe(Infinity);
  });
});

describe("isSupplyStarted / supplyStartedAt / startSupplyTimer / stopSupplyTimer", () => {
  it("не запущен по умолчанию", () => {
    const doc = docWithFlags();
    expect(isSupplyStarted(doc, "voidAirStartedAt")).toBe(false);
    expect(supplyStartedAt(doc, "voidAirStartedAt")).toBe(null);
  });

  it("startSupplyTimer заводит момент старта на текущий worldTime", async () => {
    globalThis.game.time = { worldTime: 50000 };
    const doc = docWithFlags();
    await startSupplyTimer(doc, "voidAirStartedAt");
    expect(isSupplyStarted(doc, "voidAirStartedAt")).toBe(true);
    expect(supplyStartedAt(doc, "voidAirStartedAt")).toBe(50000);
  });

  it("повторный старт уже запущенного таймера не перезаписывает момент (не теряет накопленный расход)", async () => {
    globalThis.game.time = { worldTime: 50000 };
    const doc = docWithFlags();
    await startSupplyTimer(doc, "voidAirStartedAt");
    globalThis.game.time = { worldTime: 60000 };
    await startSupplyTimer(doc, "voidAirStartedAt");
    expect(supplyStartedAt(doc, "voidAirStartedAt")).toBe(50000);
  });

  it("stopSupplyTimer снимает флаг — следующий старт начнёт с нуля", async () => {
    globalThis.game.time = { worldTime: 50000 };
    const doc = docWithFlags();
    await startSupplyTimer(doc, "voidAirStartedAt");
    await stopSupplyTimer(doc, "voidAirStartedAt");
    expect(isSupplyStarted(doc, "voidAirStartedAt")).toBe(false);
  });

  it("stopSupplyTimer на не запущенном таймере — не падает", async () => {
    const doc = docWithFlags();
    await expect(stopSupplyTimer(doc, "voidAirStartedAt")).resolves.toBeUndefined();
  });

  it("без документа — не падает", async () => {
    await expect(startSupplyTimer(null, "x")).resolves.toBeUndefined();
    await expect(stopSupplyTimer(null, "x")).resolves.toBeUndefined();
  });
});
