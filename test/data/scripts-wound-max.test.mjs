// test/data/scripts-wound-max.test.mjs
//
// Сторож wdbc-zye1: весь конвейер урона считает порог смерти от ПРОИЗВОДНОГО
// максимума Ран — wounds.effectiveMax ?? wounds.max (rules/wounds.mjs). У пилота
// Саркофага Дредноута это разные числа. Скрипт Поцелуя Смерти брал голый
// wounds.max и считал «убил» на шаг раньше/позже остального боя. Любой
// скрипт в паках, зовущий woundDeathThreshold, обязан брать тот же максимум.

import { describe, it, expect } from "vitest";
import { allPacksFiles, packFileText, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

function scriptCodes(doc) {
  const out = [];
  const walk = entries => {
    for (const e of entries ?? []) {
      if (e?.kind === "group") walk(e.group?.entries);
      if (e?.kind === "script" && typeof e.code === "string") out.push(e.code);
    }
  };
  for (const g of doc?.flags?.["warhammer-dbc"]?.mechanics ?? []) walk(g?.entries);
  for (const it of doc?.items ?? []) out.push(...scriptCodes(it));
  return out;
}

describe("скрипты паков: порог смерти от производного максимума Ран (wdbc-zye1)", () => {
  it("woundDeathThreshold получает effectiveMax, а не голый wounds.max", () => {
    const bad = [];
    let calls = 0;
    for (const file of allPacksFiles()) {
      const text = packFileText(file);
      if (!text.includes("woundDeathThreshold")) continue;
      for (const code of scriptCodes(JSON.parse(text))) {
        for (const m of code.matchAll(/woundDeathThreshold\(([^)]*)\)/g)) {
          calls++;
          if (!m[1].includes("effectiveMax")) bad.push(`${file}: ${m[0]}`);
        }
      }
    }
    expect(calls).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});
