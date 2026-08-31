import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { inventoryOverloadTier, inventoryOverloadPenalty } from "../../module/rules/encumbrance.mjs";

function actor(enc) {
  return { system: { encumbrance: enc } };
}

describe("inventoryOverloadTier: Перевес инвентаря (стр. 27)", () => {
  it("null, когда вес в пределах Ношения", () => {
    expect(inventoryOverloadTier(actor({ current: 30, effectiveCurrent: 30, carry: 60 }))).toBeNull();
  });

  it("null ровно на границе Ношения (<= carry — ещё не Перевес)", () => {
    expect(inventoryOverloadTier(actor({ effectiveCurrent: 60, carry: 60 }))).toBeNull();
  });

  it("тир −10/−1, когда вес превышает Ношение", () => {
    expect(inventoryOverloadTier(actor({ effectiveCurrent: 61, carry: 60 })))
      .toEqual({ moveAtkMod: -10, spdMod: -1 });
  });

  it("учитывает effectiveCurrent (с гравитацией), а не голый current", () => {
    expect(inventoryOverloadTier(actor({ current: 40, effectiveCurrent: 80, carry: 60 })))
      .toEqual({ moveAtkMod: -10, spdMod: -1 });
    expect(inventoryOverloadTier(actor({ current: 80, effectiveCurrent: 40, carry: 60 })))
      .toBeNull();
  });

  it("нет данных о Ношении (carry 0) — не считаем перегрузом", () => {
    expect(inventoryOverloadTier(actor({ effectiveCurrent: 5, carry: 0 }))).toBeNull();
  });

  it("нет предмета actor/encumbrance вовсе — не падает", () => {
    expect(inventoryOverloadTier(null)).toBeNull();
    expect(inventoryOverloadTier({})).toBeNull();
  });
});

describe("inventoryOverloadPenalty: применение к тесту", () => {
  const overloaded = actor({ effectiveCurrent: 61, carry: 60 });
  const normal     = actor({ effectiveCurrent: 30, carry: 60 });

  it("−10 на физическую характеристику при Перевесе", () => {
    expect(inventoryOverloadPenalty(overloaded, { charKey: "ws" })).toBe(-10);
    expect(inventoryOverloadPenalty(overloaded, { charKey: "AG" })).toBe(-10);
  });

  it("−10 на Уклонение/Парирование (те же «движения»)", () => {
    expect(inventoryOverloadPenalty(overloaded, { skillKey: "dodge" })).toBe(-10);
    expect(inventoryOverloadPenalty(overloaded, { skillKey: "parry" })).toBe(-10);
  });

  it("0 на ментальные/социальные характеристики", () => {
    expect(inventoryOverloadPenalty(overloaded, { charKey: "wp" })).toBe(0);
    expect(inventoryOverloadPenalty(overloaded, { charKey: "fel" })).toBe(0);
  });

  it("0 без Перевеса", () => {
    expect(inventoryOverloadPenalty(normal, { charKey: "ws" })).toBe(0);
  });
});
