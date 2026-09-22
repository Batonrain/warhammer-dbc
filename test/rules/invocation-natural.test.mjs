// test/rules/invocation-natural.test.mjs
//
// wdbc-o368c: Дары Одержимости дают Deadly Natural Weapon «с рейтингом как
// от Проявления» — таблица Invocation, строка «Deadly Nat. Weap.»:
// Cor 1-35 → 0, 36-55 → 1, 56-70 → 1, 71-90 → 2, 91-100 → 2. Не Cor.b.

import { describe, it, expect } from "vitest";
import { invocationDnwRating, invocationNaturalAdd } from "../../module/rules/invocation-natural.mjs";
import { WEAPON_PROPERTIES } from "../../module/constants/weapon-properties.mjs";

const actor = cor => ({ system: { corruption: { value: cor } } });

describe("invocationDnwRating — границы полос таблицы", () => {
  it.each([[0, 0], [35, 0], [36, 1], [55, 1], [56, 1], [70, 1], [71, 2], [90, 2], [91, 2], [100, 2]])(
    "Cor %i → %i", (cor, want) => expect(invocationDnwRating(cor)).toBe(want));
});

describe("invocationNaturalAdd", () => {
  it("DNW Проявления — к урону и Пробитию", () => {
    expect(invocationNaturalAdd({ invocationNaturalWeapon: true }, actor(50))).toEqual({ dmg: 1, pen: 1 });
  });
  it("Укус Пасти — только к урону", () => {
    expect(invocationNaturalAdd({ invocationNaturalDamage: true }, actor(80))).toEqual({ dmg: 2, pen: 0 });
  });
  it("обычное оружие — ничего", () => {
    expect(invocationNaturalAdd({}, actor(100))).toEqual({ dmg: 0, pen: 0 });
  });
  it("при Cor 50 — 1, а не Cor.b 5 (свойство deadlyNaturalCorB тут не годится)", () => {
    expect(invocationNaturalAdd({ invocationNaturalWeapon: true }, actor(50)).dmg).toBe(1);
  });
});

describe("свойства зарегистрированы и несут свой auto-флаг", () => {
  it.each(["invocationNaturalWeapon", "invocationNaturalDamage"])("%s", key => {
    expect(WEAPON_PROPERTIES[key]?.auto?.[key]).toBe(true);
  });
});
