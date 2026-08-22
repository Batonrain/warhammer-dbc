// test/combat/disabled-armour-penalty.test.mjs
//
// Штраф выключенной силовой брони (стр. 233): −10 физическому действию,
// −40 физической реакции (Уклонение/Парирование), ничего — ментальным
// тестам и включённой/снятой броне. Поверх плоского −10 действию
// добавляется ещё −10 каскада перевеса (disabled-armour-overload.test.mjs),
// если он не погашен исключением «Ношение по чистому S.b ≥5× веса брони».

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { disabledArmourPenalty } from "../../module/combat/armor-mods.mjs";

const armor = (weight, active = false, equipped = true) =>
  ({ type: "armor", system: { equipped, armorType: "power", active, weight } });

// encumbrance достаточно большое, чтобы веса легковесной тестовой брони
// никогда не хватало на перевес (проверяем базовый штраф изолированно).
const roomyEnc = { carry: 1000, lift: 2000, push: 4000 };

const actorWith = (items, encumbrance = roomyEnc, sBonus = 0) => ({
  items, system: { encumbrance, characteristics: { s: { bonus: sBonus } } }
});

describe("штраф выключенной силовой брони", () => {
  it("включённая броня — 0", () => {
    const actor = actorWith([armor(10, true)]);
    expect(disabledArmourPenalty(actor, { charKey: "ws" })).toBe(0);
  });

  it("нет брони вовсе — 0", () => {
    expect(disabledArmourPenalty(actorWith([]), { charKey: "ws" })).toBe(0);
  });

  it("выключенная, вес не создаёт перевеса — плоские −10 физическому действию", () => {
    const actor = actorWith([armor(10)]);
    expect(disabledArmourPenalty(actor, { charKey: "ws" })).toBe(-10);
    expect(disabledArmourPenalty(actor, { charKey: "ag" })).toBe(-10);
  });

  it("ментальная характеристика — 0, даже с выключенной бронёй", () => {
    const actor = actorWith([armor(10)]);
    expect(disabledArmourPenalty(actor, { charKey: "int" })).toBe(0);
  });

  it("Уклонение/Парирование — −40, без перевеса", () => {
    const actor = actorWith([armor(10)]);
    expect(disabledArmourPenalty(actor, { skillKey: "dodge" })).toBe(-40);
    expect(disabledArmourPenalty(actor, { skillKey: "parry" })).toBe(-40);
  });

  it("перевес тир 1 добавляет ещё −10 физическому действию (итого −20)", () => {
    const actor = actorWith([armor(150)], { carry: 100, lift: 200, push: 400 });
    expect(disabledArmourPenalty(actor, { charKey: "ws" })).toBe(-20);
  });

  it("перевес НЕ добавляется к реакции (−40 остаётся −40)", () => {
    const actor = actorWith([armor(150)], { carry: 100, lift: 200, push: 400 });
    expect(disabledArmourPenalty(actor, { skillKey: "dodge" })).toBe(-40);
  });

  it("исключение по S.b гасит каскад — остаётся плоский −10", () => {
    const actor = actorWith([armor(6)], { carry: 5, lift: 10, push: 20 }, 8);
    expect(disabledArmourPenalty(actor, { charKey: "ws" })).toBe(-10);
  });
});
