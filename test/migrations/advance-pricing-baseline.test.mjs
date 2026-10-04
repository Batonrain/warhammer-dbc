// test/migrations/advance-pricing-baseline.test.mjs
//
// Закрепление режима цен мира и пересчёт цен после сверки «Склонности»
// (migrations/advance-pricing-baseline.mjs, решение владельца 04.10.2026).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const recalc = vi.fn(async () => {});
vi.mock("../../module/sheets/tabs/advance.mjs", () => ({ recalcAllAdvanceCosts: (a) => recalc(a) }));

import { migrateAdvancePricing, advancePricingSaved } from "../../module/migrations/advance-pricing-baseline.mjs";

function stubGame({ saved, actors, isGM = true }) {
  const set = vi.fn(async () => {});
  vi.stubGlobal("game", {
    user: { isGM },
    actors,
    packs: { get: () => null },
    settings: {
      set,
      storage: new Map([["world", { getSetting: () => (saved ? { value: "patronage" } : undefined) }]])
    }
  });
  vi.stubGlobal("ui", { notifications: { info: vi.fn(), warn: vi.fn() } });
  return set;
}
const chars = (n) => Array.from({ length: n }, (_, i) => ({ type: "character", name: `Перс ${i}` }));

beforeEach(() => recalc.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("закрепление режима цен мира", () => {
  it("настройка ни разу не сохранялась и в мире есть Персонажи — закрепляется «Склонности»", async () => {
    const set = stubGame({ saved: false, actors: chars(2) });
    const r = await migrateAdvancePricing();
    expect(set).toHaveBeenCalledWith("warhammer-dbc", "advancePricingMode", "aptitude");
    expect(r).toMatchObject({ pinned: true, fixed: 2, failed: 0 });
  });

  it("новый пустой мир остаётся на книжном умолчании", async () => {
    const set = stubGame({ saved: false, actors: [{ type: "vehicle" }] });
    const r = await migrateAdvancePricing();
    expect(set).not.toHaveBeenCalled();
    expect(r.pinned).toBe(false);
  });

  it("сохранённый выбор ГМа не трогается", async () => {
    const set = stubGame({ saved: true, actors: chars(1) });
    await migrateAdvancePricing();
    expect(set).not.toHaveBeenCalled();
  });

  it("не удалось проверить настройку — считается сохранённой, мир не меняется", () => {
    vi.stubGlobal("game", { settings: { storage: { get: () => { throw new Error("нет"); } } } });
    expect(advancePricingSaved()).toBe(true);
  });
});

describe("пересчёт цен", () => {
  it("пересчитывается у каждого Персонажа, прочие акторы не трогаются", async () => {
    stubGame({ saved: true, actors: [...chars(2), { type: "vehicle", name: "Лёгкий танк" }] });
    await migrateAdvancePricing();
    expect(recalc).toHaveBeenCalledTimes(2);
  });

  it("сбой на одном акторе не останавливает остальных и попадает в результат", async () => {
    stubGame({ saved: true, actors: chars(3) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    recalc.mockImplementationOnce(async () => { throw new Error("сбой"); });
    const r = await migrateAdvancePricing();
    expect(r).toMatchObject({ fixed: 2, failed: 1 });
  });

  it("не ГМ — ничего не делает", async () => {
    stubGame({ saved: false, actors: chars(1), isGM: false });
    const r = await migrateAdvancePricing();
    expect(r).toBeUndefined();
    expect(recalc).not.toHaveBeenCalled();
  });
});
