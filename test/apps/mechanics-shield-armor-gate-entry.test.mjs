// test/apps/mechanics-shield-armor-gate-entry.test.mjs
//
// kind:"shieldArmorGate" (wdbc-giae) — «Щит: только по бронированным
// участкам» в Конструкторе, для предметов type:"forcefield" (Frozen Heart/
// Морозное Сердце). Как и kind:"shieldSubtype"/"shieldVsCondition" НЕ заводит
// синтетический ActiveEffect на акторе (не входит в DURABLE_MECH_KINDS) —
// combat/damage.mjs::_rollActiveShield читает запись напрямую с предмета
// щита в момент выбора активного щита. Запись без полей — само её присутствие
// и есть флаг, поэтому isEntryComplete всегда true. Поведение самого броска
// щита — в test/combat/shield-armor-gate.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { describeMechEntry, DURABLE_MECH_KINDS } from "../../module/apps/mechanics.mjs";

describe("describeMechEntry — kind:shieldArmorGate", () => {
  it("описание — «не срабатывает по локациям без брони, требует Жёсткой брони на торсе» (wdbc-yday)", () => {
    expect(describeMechEntry({ id: "e1", kind: "shieldArmorGate" }))
      .toBe("Щит: не срабатывает по локациям без надетой брони (и требует надетой Жёсткой брони на торсе)");
  });
});

describe("shieldArmorGate не участвует в DURABLE_MECH_KINDS", () => {
  it("не создаёт синтетический ActiveEffect на акторе — живой запрос, читается напрямую с предмета (wdbc-giae)", () => {
    expect(DURABLE_MECH_KINDS.has("shieldArmorGate")).toBe(false);
  });
});
