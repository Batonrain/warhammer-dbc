// test/apps/mechanics-capability-cost.test.mjs
//
// wdbc-1dc8: запись Конструктора kind:"capability" получает необязательное
// поле cost {pool, amount} — blankMechEntry заводит его пустым (бесплатно, как
// раньше), describeMechEntry показывает цену в превью, когда она задана.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { blankMechEntry, describeMechEntry } from "../../module/apps/mechanics.mjs";

describe("kind:capability — cost (wdbc-1dc8)", () => {
  it("blankMechEntry заводит запись без цены (бесплатно по умолчанию)", () => {
    const e = blankMechEntry("capability");
    expect(e.capabilityCostPool).toBe("");
    expect(e.capabilityCostAmount).toBe(1);
  });

  it("describeMechEntry без цены — как раньше, без суффикса", () => {
    const e = { ...blankMechEntry("capability"), capabilityKey: "healing.astartes" };
    expect(describeMechEntry(e)).not.toContain("цена");
  });

  it("describeMechEntry с ценой — суффикс «— цена: N Очко(-а/-ов) <Пула>»", () => {
    const e = { ...blankMechEntry("capability"), capabilityKey: "healing.astartes",
      capabilityCostPool: "infamy", capabilityCostAmount: 1 };
    expect(describeMechEntry(e)).toContain("— цена: 1 Очко Бесчестия");
  });

  it("сумма > 1 склоняется правильно в превью", () => {
    const e = { ...blankMechEntry("capability"), capabilityKey: "healing.astartes",
      capabilityCostPool: "fate", capabilityCostAmount: 3 };
    expect(describeMechEntry(e)).toContain("3 Очка Судьбы");
  });
});
