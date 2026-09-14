// test/apps/mechanics-shield-subtype-entry.test.mjs
//
// kind:"shieldSubtype" (wdbc-q0q8) — «Щит: подвид урона» в Конструкторе, для
// предметов type:"forcefield" (Нерушимая Лента, Морозное Сердце). В отличие
// от kind:"absorption" НЕ заводит синтетический ActiveEffect на акторе (не
// входит в DURABLE_MECH_KINDS) — combat/damage.mjs::_rollActiveShield читает
// запись напрямую с самого предмета щита. Здесь проверяется только читаемое
// описание записи (describeMechEntry); поведение самого броска щита —
// test/combat/shield-subtype.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { describeMechEntry, DURABLE_MECH_KINDS } from "../../module/apps/mechanics.mjs";

const entry = (mode, key, ratingMax) =>
  ({ id: "e1", kind: "shieldSubtype", shieldSubtypeMode: mode, shieldSubtypeKey: key, shieldSubtypeRatingMax: ratingMax });

describe("describeMechEntry — kind:shieldSubtype", () => {
  it("exclude — «щит не действует против подвида»", () => {
    expect(describeMechEntry(entry("exclude", "crushing"))).toBe("Щит: не действует против Дробящий I(Cr)");
  });

  it("override — «рейтинг заменяется на 1-N»", () => {
    expect(describeMechEntry(entry("override", "flame", 75))).toBe("Щит: против Огненный E(Fl) рейтинг заменяется на 1–75");
  });

  it("подвид не выбран — «не задано»", () => {
    expect(describeMechEntry(entry("exclude", ""))).toBe("Щит: подвид урона (не задано)");
  });
});

describe("shieldSubtype не участвует в DURABLE_MECH_KINDS", () => {
  it("не создаёт синтетический ActiveEffect на акторе — читается напрямую с предмета (wdbc-q0q8)", () => {
    expect(DURABLE_MECH_KINDS.has("shieldSubtype")).toBe(false);
  });
});
