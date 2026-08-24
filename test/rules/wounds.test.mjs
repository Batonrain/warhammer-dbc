// test/rules/wounds.test.mjs
//
// Единая арифметика понижения Ран (wdbc-aleb) — раньше три с лишним места
// (боевой урон, Токсичное, Выжигание Души, резонанс саркофага Дредноута)
// считали переход в Критические каждое по-своему, и Токсичное расходилось с
// книгой (просто клампило в 0, Критические не наступали никогда).

import { describe, it, expect } from "vitest";
import { woundLossAfter, woundLossUpdates, applyWoundLoss, woundDeathThreshold } from "../../module/rules/wounds.mjs";

function actor({ value = 10, critical = 0, max = 10 } = {}) {
  const updates = [];
  return {
    system: { wounds: { value, critical, max } },
    updates,
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

describe("woundLossAfter: чистый расчёт", () => {
  it("урон меньше текущих Ран — просто вычитается", () => {
    expect(woundLossAfter(10, 0, 4)).toEqual({ value: 6, critical: 0, overflow: false });
  });

  it("урон точно добивает до нуля — без перехода в Критические", () => {
    expect(woundLossAfter(4, 0, 4)).toEqual({ value: 0, critical: 0, overflow: false });
  });

  it("урон больше Ран — остаток идёт в Критические", () => {
    expect(woundLossAfter(3, 1, 7)).toEqual({ value: 0, critical: 5, overflow: true });
  });

  it("нулевой или отрицательный урон ничего не меняет", () => {
    expect(woundLossAfter(8, 0, 0)).toEqual({ value: 8, critical: 0, overflow: false });
    expect(woundLossAfter(8, 0, -5)).toEqual({ value: 8, critical: 0, overflow: false });
  });

  it("нечисловые входы считаются нулём, а не NaN", () => {
    expect(woundLossAfter(undefined, undefined, 3)).toEqual({ value: 0, critical: 3, overflow: true });
  });
});

describe("woundLossUpdates: кусок для общего actor.update()", () => {
  it("урон даёт value/critical и сброс firstAidUsed", () => {
    expect(woundLossUpdates({ wounds: { value: 2, critical: 1 } }, 5)).toEqual({
      "system.wounds.value": 0,
      "system.wounds.critical": 4,
      "system.wounds.firstAidUsed": false
    });
  });

  it("нулевой урон firstAidUsed не трогает", () => {
    expect(woundLossUpdates({ wounds: { value: 8, critical: 0 } }, 0)).toEqual({
      "system.wounds.value": 8,
      "system.wounds.critical": 0
    });
  });
});

describe("applyWoundLoss: применение к актору", () => {
  it("пишет новые Раны/Критические в actor.update", async () => {
    const a = actor({ value: 10, critical: 0 });
    const result = await applyWoundLoss(a, 4);
    expect(result).toMatchObject({
      applied: true, currentWounds: 10, currentCritical: 0,
      newWounds: 6, newCritical: 0, maxWounds: 10, overflow: false, gotCritical: false
    });
    expect(a.system.wounds).toEqual({ value: 6, critical: 0, max: 10 });
    expect(a.updates).toHaveLength(1);
  });

  it("переполнение уходит в Критические", async () => {
    const a = actor({ value: 3, critical: 1, max: 10 });
    const result = await applyWoundLoss(a, 7);
    expect(result).toMatchObject({ newWounds: 0, newCritical: 5, overflow: true, gotCritical: true });
    expect(a.system.wounds.critical).toBe(5);
  });

  it("фактический урон сбрасывает firstAidUsed — Первая Помощь снова доступна", async () => {
    // Раньше это делал только computeWoundDamage (tabs/wounds.mjs); без
    // сброса здесь Первая Помощь оставалась бы запертой навсегда после
    // первого применения (гейт в tabs/healing.mjs).
    const a = actor({ value: 10, critical: 0 });
    await applyWoundLoss(a, 4);
    expect(a.updates[0]["system.wounds.firstAidUsed"]).toBe(false);
  });

  it("нулевой урон не шлёт update вовсе", async () => {
    const a = actor({ value: 8, critical: 0 });
    const result = await applyWoundLoss(a, 0);
    expect(result.applied).toBe(false);
    expect(a.updates).toHaveLength(0);
  });

  it("отсутствующий system.wounds не роняет расчёт (актор без инициализации)", async () => {
    const a = { system: {}, updates: [], async update(data) { this.updates.push(data); } };
    const result = await applyWoundLoss(a, 5);
    expect(result).toMatchObject({ currentWounds: 0, newWounds: 0, newCritical: 5, gotCritical: true });
  });
});

describe("woundDeathThreshold: порог гибели по Критическим", () => {
  it("Макс Ран + 7", () => {
    expect(woundDeathThreshold(10)).toBe(17);
    expect(woundDeathThreshold(0)).toBe(7);
  });
});
