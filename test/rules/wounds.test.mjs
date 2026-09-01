// test/rules/wounds.test.mjs
//
// Единая арифметика понижения Ран (wdbc-aleb) — раньше три с лишним места
// (боевой урон, Токсичное, Выжигание Души, резонанс саркофага Дредноута)
// считали переход в Критические каждое по-своему, и Токсичное расходилось с
// книгой (просто клампило в 0, Критические не наступали никогда).

import { describe, it, expect } from "vitest";
import { woundLossAfter, woundLossUpdates, applyWoundLoss, woundDeathThreshold, ablativeAbsorb } from "../../module/rules/wounds.mjs";

function actor({ value = 10, critical = 0, max = 10, ablative = 0, ablativeMax = 0 } = {}) {
  const updates = [];
  return {
    system: { wounds: { value, critical, max, ablative, ablativeMax } },
    updates,
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
      if (data["system.wounds.ablative"] !== undefined) this.system.wounds.ablative = data["system.wounds.ablative"];
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
    expect(a.system.wounds).toEqual({ value: 6, critical: 0, max: 10, ablative: 0, ablativeMax: 0 });
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

  it("Саркофаг Дредноута: effectiveMax (wdbc-drn) идёт вместо max, когда есть", async () => {
    // maxWounds сам по себе не участвует в арифметике потери (та считается от
    // текущих Ран) — но именно его возвращает applyWoundLoss для
    // woundDeathThreshold(maxWounds) у вызывающего кода (hooks.mjs,
    // condition-ticks.mjs), поэтому важно, что тут effectiveMax, а не max.
    const a = { system: { wounds: { value: 8, critical: 0, max: 25, effectiveMax: 20 } },
                updates: [], async update(data) { this.updates.push(data); } };
    const result = await applyWoundLoss(a, 3);
    expect(result.maxWounds).toBe(20);
  });

  it("без effectiveMax — как раньше, берётся обычный max", async () => {
    const a = { system: { wounds: { value: 8, critical: 0, max: 25 } },
                updates: [], async update(data) { this.updates.push(data); } };
    const result = await applyWoundLoss(a, 30);
    expect(result.maxWounds).toBe(25);
  });
});

describe("ablativeAbsorb: чистый расчёт поглощения (wdbc-smy7)", () => {
  it("пула хватает целиком — весь урон поглощён", () => {
    expect(ablativeAbsorb(10, 4)).toEqual({ ablative: 6, absorbed: 4, remaining: 0 });
  });

  it("пула не хватает — остаток идёт дальше", () => {
    expect(ablativeAbsorb(3, 7)).toEqual({ ablative: 0, absorbed: 3, remaining: 4 });
  });

  it("пул пуст — весь урон проходит насквозь", () => {
    expect(ablativeAbsorb(0, 5)).toEqual({ ablative: 0, absorbed: 0, remaining: 5 });
  });

  it("нулевой урон ничего не меняет", () => {
    expect(ablativeAbsorb(5, 0)).toEqual({ ablative: 5, absorbed: 0, remaining: 0 });
  });
});

describe("woundLossUpdates: аблативный пул поглощает урон первым", () => {
  it("есть пул и он весь урон гасит — обычные Раны не трогаются", () => {
    expect(woundLossUpdates({ wounds: { value: 8, critical: 0, ablative: 10, ablativeMax: 10 } }, 4)).toEqual({
      "system.wounds.value": 8,
      "system.wounds.critical": 0,
      "system.wounds.ablative": 6,
      "system.wounds.firstAidUsed": false
    });
  });

  it("пул гасит часть — остаток уходит в обычные Раны", () => {
    expect(woundLossUpdates({ wounds: { value: 8, critical: 0, ablative: 3, ablativeMax: 10 } }, 7)).toEqual({
      "system.wounds.value": 4,
      "system.wounds.critical": 0,
      "system.wounds.ablative": 0,
      "system.wounds.firstAidUsed": false
    });
  });

  it("нет пула вовсе (ablativeMax=0) — поле ablative даже не пишется, поведение как раньше", () => {
    expect(woundLossUpdates({ wounds: { value: 8, critical: 0 } }, 5)).toEqual({
      "system.wounds.value": 3,
      "system.wounds.critical": 0,
      "system.wounds.firstAidUsed": false
    });
  });
});

describe("applyWoundLoss: аблативный пул поглощает урон первым", () => {
  it("поглощает целиком — обычные Раны не меняются, но update всё равно уходит", async () => {
    const a = actor({ value: 8, critical: 0, ablative: 10, ablativeMax: 10 });
    const result = await applyWoundLoss(a, 4);
    expect(result).toMatchObject({ applied: true, newWounds: 8, newCritical: 0, ablativeAbsorbed: 4 });
    expect(a.system.wounds.ablative).toBe(6);
    expect(a.system.wounds.value).toBe(8);
  });

  it("поглощает частично — остаток обычным урона идёт как раньше", async () => {
    const a = actor({ value: 8, critical: 0, ablative: 3, ablativeMax: 10 });
    const result = await applyWoundLoss(a, 7);
    expect(result).toMatchObject({ newWounds: 4, newCritical: 0, ablativeAbsorbed: 3 });
    expect(a.system.wounds.ablative).toBe(0);
  });

  it("нет пула — ablativeAbsorbed 0, поведение байт-в-байт как раньше", async () => {
    const a = actor({ value: 8, critical: 0 });
    const result = await applyWoundLoss(a, 4);
    expect(result.ablativeAbsorbed).toBe(0);
    expect(a.updates[0]).not.toHaveProperty("system.wounds.ablative");
  });
});

describe("woundDeathThreshold: порог гибели по Критическим", () => {
  it("Макс Ран + 7", () => {
    expect(woundDeathThreshold(10)).toBe(17);
    expect(woundDeathThreshold(0)).toBe(7);
  });
});
