// test/rules/daemonblood.test.mjs
//
// wdbc-173l (остаток аудита «аблатив»): психосила «Daemonblood / Кровь
// Демонов» — «Тратит 1-3×PR крови → столько же аблативных Ран».

import { describe, it, expect } from "vitest";
import { isDaemonbloodItem, daemonbloodOptions, daemonbloodGrant, daemonbloodShrinkToFit }
  from "../../module/rules/daemonblood.mjs";

describe("isDaemonbloodItem", () => {
  it("узнаёт психосилу по книжному двуязычному имени", () => {
    expect(isDaemonbloodItem({ type: "psychicPower", name: "Daemonblood / Кровь Демонов" })).toBe(true);
  });
  it("не путает с другой психосилой того же типа", () => {
    expect(isDaemonbloodItem({ type: "psychicPower", name: "Godkin / Богорождённый" })).toBe(false);
  });
  it("не путает с Мутацией другого типа с похожим текстом", () => {
    expect(isDaemonbloodItem({ type: "mutation", name: "Daemonblood / Кровь Демонов" })).toBe(false);
  });
});

describe("daemonbloodOptions: 1/2/3×PR, обрезано запасом живых Ран", () => {
  it("хватает крови на все три варианта", () => {
    expect(daemonbloodOptions(4, 20)).toEqual([
      { mult: 1, wanted: 4,  amount: 4,  capped: false },
      { mult: 2, wanted: 8,  amount: 8,  capped: false },
      { mult: 3, wanted: 12, amount: 12, capped: false }
    ]);
  });

  it("недостаточно Ран — старшие варианты обрезаются запасом, не пропадают", () => {
    expect(daemonbloodOptions(4, 6)).toEqual([
      { mult: 1, wanted: 4, amount: 4, capped: false },
      { mult: 2, wanted: 8, amount: 6, capped: true },
      { mult: 3, wanted: 12, amount: 6, capped: true }
    ]);
  });

  it("PR 0 — вариантов нет", () => {
    expect(daemonbloodOptions(0, 10)).toEqual([]);
  });

  it("живых Ран не осталось — вариантов нет", () => {
    expect(daemonbloodOptions(5, 0)).toEqual([]);
  });
});

describe("daemonbloodGrant: живые Раны списываются НАПРЯМУЮ (не через аблативный пул)", () => {
  it("тратит Раны, выдаёт столько же аблативных с нуля", () => {
    const system = { wounds: { value: 12, critical: 0, ablative: 0, ablativeMax: 0 } };
    expect(daemonbloodGrant(system, 0, 4)).toEqual({
      wounds: 8, critical: 0, ablative: 4, ablativeMax: 4, contribution: 4
    });
  });

  it("посторонний аблативный пул (напр. Godkin) НЕ поглощает трату крови", () => {
    // 5 живых Ран, но есть 10 постороннего аблатива — трата всё равно режет живые Раны.
    const system = { wounds: { value: 5, critical: 0, ablative: 10, ablativeMax: 10 } };
    const result = daemonbloodGrant(system, 0, 3);
    expect(result.wounds).toBe(2); // 5 - 3, не 5 (поглощено бы аблативом)
    expect(result.ablative).toBe(13); // 10 чужого + 3 своего
    expect(result.contribution).toBe(3);
  });

  it("повторное применение переоформляет вклад, не складывает (тем же приёмом, что Cancerous Healing)", () => {
    const system = { wounds: { value: 8, critical: 0, ablative: 4, ablativeMax: 4 } };
    // Прошлый вклад — 4 (весь текущий пул), новый выбор — 8: заменяет 4 на 8.
    expect(daemonbloodGrant(system, 4, 8)).toMatchObject({ ablative: 8, ablativeMax: 8, contribution: 8 });
  });

  it("трата больше запаса Ран НЕ уходит в Критические — вызывающий код обязан обрезать через daemonbloodOptions", () => {
    // daemonbloodGrant сам не защищает от этого — чистая арифметика woundLossAfter.
    const system = { wounds: { value: 2, critical: 0, ablative: 0, ablativeMax: 0 } };
    expect(daemonbloodGrant(system, 0, 5)).toMatchObject({ wounds: 0, critical: 3, ablative: 5 });
  });
});

describe("daemonbloodShrinkToFit: доля не больше, чем реально осталось в общем пуле", () => {
  it("пул уменьшился (урон) — доля Daemonblood ужимается вслед", () => {
    const system = { wounds: { ablative: 3, ablativeMax: 6 } }; // было 6, поглотили 3
    expect(daemonbloodShrinkToFit(system, 6)).toEqual({ ablativeMax: 3, contribution: 3 });
  });
  it("пул не трогали — null, писать нечего", () => {
    const system = { wounds: { ablative: 6, ablativeMax: 6 } };
    expect(daemonbloodShrinkToFit(system, 6)).toBeNull();
  });
  it("своего вклада не было — null", () => {
    const system = { wounds: { ablative: 3 } };
    expect(daemonbloodShrinkToFit(system, 0)).toBeNull();
  });
});
