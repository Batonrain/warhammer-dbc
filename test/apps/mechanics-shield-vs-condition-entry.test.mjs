// test/apps/mechanics-shield-vs-condition-entry.test.mjs
//
// kind:"shieldVsCondition" (wdbc-5knb) — «Щит: против тика Состояния» в
// Конструкторе, для предметов type:"forcefield" (Frozen Heart/Морозное
// Сердце). Как и kind:"shieldSubtype" НЕ заводит синтетический ActiveEffect
// на акторе (не входит в DURABLE_MECH_KINDS) — combat/damage.mjs::
// rollShieldAgainstConditionTick читает запись напрямую с предмета щита в
// момент ТИКА Состояния. Здесь проверяется только читаемое описание записи
// (describeMechEntry); поведение самого броска щита против тика — в
// test/combat/shield-vs-condition-tick.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { describeMechEntry, DURABLE_MECH_KINDS } from "../../module/apps/mechanics.mjs";

const entry = (key) => ({ id: "e1", kind: "shieldVsCondition", shieldVsConditionKey: key });

describe("describeMechEntry — kind:shieldVsCondition", () => {
  it("burning — «можно бросить против тика, снимает Состояние целиком»", () => {
    expect(describeMechEntry(entry("burning")))
      .toBe("Щит: можно бросить против тика «Горение» — при успехе Состояние снимается целиком");
  });

  it("состояние не выбрано — «не задано»", () => {
    expect(describeMechEntry(entry(""))).toBe("Щит: против тика Состояния (не задано)");
  });
});

describe("shieldVsCondition не участвует в DURABLE_MECH_KINDS", () => {
  it("не создаёт синтетический ActiveEffect на акторе — живой запрос, читается напрямую с предмета (wdbc-5knb)", () => {
    expect(DURABLE_MECH_KINDS.has("shieldVsCondition")).toBe(false);
  });
});
