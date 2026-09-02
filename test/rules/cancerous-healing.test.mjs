// test/rules/cancerous-healing.test.mjs
//
// wdbc-w8ws: Мутация «Cancerous Healing / Раковое Исцеление» — арифметика
// гранта аблативных Ран цели и штрафа A/S. Foundry-обвязка (касание текущей
// цели, чат, ActiveEffect, флаг вклада) — module/apps/cancerous-healing.mjs.

import { describe, it, expect } from "vitest";
import { isCancerousHealingItem, cancerousHealingGrant, cancerousHealingShrinkAfterHeal,
         cancerousHealingPenaltyValue } from "../../module/rules/cancerous-healing.mjs";

describe("isCancerousHealingItem", () => {
  it("узнаёт Мутацию по книжному двуязычному имени", () => {
    expect(isCancerousHealingItem({ type: "mutation", name: "Cancerous Healing / Раковое Исцеление" })).toBe(true);
  });

  it("не путает с другой Мутацией или предметом другого типа", () => {
    expect(isCancerousHealingItem({ type: "mutation", name: "Flayed / Освежёванный" })).toBe(false);
    expect(isCancerousHealingItem({ type: "talent", name: "Cancerous Healing" })).toBe(false);
    expect(isCancerousHealingItem(null)).toBe(false);
  });
});

describe("cancerousHealingGrant: аблатив = недостающим Ранам, свой вклад заменяется целиком", () => {
  it("с нуля — доля = недостающим Ранам, ablativeMax двигается вместе", () => {
    expect(cancerousHealingGrant({ wounds: { max: 10, value: 4, ablative: 0, ablativeMax: 0 } }, 0))
      .toEqual({ newAblative: 6, newAblativeMax: 6, contribution: 6, missing: 6 });
  });

  it("цель не ранена — доля 0", () => {
    expect(cancerousHealingGrant({ wounds: { max: 10, value: 10, ablative: 0, ablativeMax: 0 } }, 0))
      .toEqual({ newAblative: 0, newAblativeMax: 0, contribution: 0, missing: 0 });
  });

  it("повторное касание ЗАМЕНЯЕТ прошлую долю, не складывая её саму с собой", () => {
    // Прошлый раз дал 6 (было max=10,value=4); сейчас value=7 → missing=3.
    const system = { wounds: { max: 10, value: 7, ablative: 6, ablativeMax: 6 } };
    expect(cancerousHealingGrant(system, 6)).toEqual({ newAblative: 3, newAblativeMax: 3, contribution: 3, missing: 3 });
  });

  it("посторонний аблатив на цели (другой источник) остаётся нетронутым", () => {
    // Пул 9: 6 от Ракового Исцеления (прошлый раз) + 3 постороннего.
    const system = { wounds: { max: 10, value: 8, ablative: 9, ablativeMax: 9 } };
    expect(cancerousHealingGrant(system, 6)).toMatchObject({ newAblative: 5, newAblativeMax: 5, contribution: 2 });
  });

  it("сумма (доля + обычные Раны) никогда не превышает максимум", () => {
    const { contribution } = cancerousHealingGrant({ wounds: { max: 10, value: 3, ablative: 0, ablativeMax: 0 } }, 0);
    expect(contribution + 3).toBeLessThanOrEqual(10);
  });
});

describe("cancerousHealingShrinkAfterHeal: лишний аблатив теряется при лечении, не растёт от урона", () => {
  it("лечение сверх потолка — доля сжимается до новых недостающих Ран", () => {
    // Было: доля 6 (max 10, value 4). Вылечили 3 → value 7, missing 3.
    const system = { wounds: { max: 10, value: 7, ablative: 6, ablativeMax: 6 } };
    expect(cancerousHealingShrinkAfterHeal(system, 6)).toEqual({ newAblative: 3, newAblativeMax: 3, contribution: 3 });
  });

  it("лечение, не пробивающее текущую долю, ничего не меняет", () => {
    const system = { wounds: { max: 10, value: 5, ablative: 3, ablativeMax: 3 } };
    expect(cancerousHealingShrinkAfterHeal(system, 3)).toBeNull();
  });

  it("НЕ растёт обратно от последующего урона (missing вырос, доля не подтягивается)", () => {
    // Было: доля 3 (после лечения). Затем цель получила урон, value упал до 2.
    const system = { wounds: { max: 10, value: 2, ablative: 3, ablativeMax: 3 } };
    expect(cancerousHealingShrinkAfterHeal(system, 3)).toBeNull();
  });

  it("нулевая прошлая доля — нечего сжимать", () => {
    expect(cancerousHealingShrinkAfterHeal({ wounds: { max: 10, value: 10 } }, 0)).toBeNull();
  });
});

describe("cancerousHealingPenaltyValue: −2 A/−2 S за аблативную Рану", () => {
  it("линейно растёт с пулом", () => {
    expect(cancerousHealingPenaltyValue(0)).toBe(0);
    expect(cancerousHealingPenaltyValue(1)).toBe(2);
    expect(cancerousHealingPenaltyValue(6)).toBe(12);
  });

  it("отрицательный/нечисловой пул не даёт отрицательный штраф", () => {
    expect(cancerousHealingPenaltyValue(-3)).toBe(0);
    expect(cancerousHealingPenaltyValue(undefined)).toBe(0);
  });
});
