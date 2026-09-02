// test/rules/beastman-shaman-rule.test.mjs
//
// Следствия метки Hex-Marked Prey/Проклятая Метка (wdbc-xxb7) через общий
// реестр правил: rules/predicates.mjs::hexMarkedPreyAllyBonus +
// rules/library/beastman-shaman.mjs, зарегистрировано как источник
// "beastmanShaman" в rules/sources.mjs. Сама выдача метки —
// module/combat/beastman-shaman.mjs::applyHexMarkedPrey (см. соответствующий
// тест). God-ответвления (Кхорн: Proven(3), Нургл: Toxic(1) на попаданиях
// союзников по цели) добавлены wdbc-w8z4 через grantWeaponProp — до этого
// были только текстом в чат-карточке.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

/** Актор-союзник: раса задаёт, беастман он или нет. */
function ally(race = "beastman") {
  return { items: [], system: { race } };
}

/** Цель с меткой Проклятого — god определяет, чья версия сработала. */
function markedTarget(god) {
  const flags = { "warhammer-dbc.hexMarkedPrey": { shamanUuid: "Actor.shaman1", god } };
  return { items: [], system: {}, getFlag: (scope, key) => flags[`${scope}.${key}`] };
}

describe("Проклятая Метка через resolveTest: базовый +15", () => {
  it("зверолюд-союзник атакует помеченную цель — +15", () => {
    const { mods } = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("khorne") });
    expect(mods).toContainEqual(
      { ruleId: "beastmanShaman.hexMarkedPrey.allyBonus", label: "Проклятая Метка: цель помечена", value: 15, halvePenalty: false });
  });

  it("не зверолюд — бонуса нет, даже если цель помечена", () => {
    const { mods } = resolveTest({ actor: ally("human"), kind: "attack", targetActor: markedTarget("khorne") });
    expect(mods).toEqual([]);
  });

  it("цель не помечена — бонуса нет", () => {
    const { mods } = resolveTest({ actor: ally(), kind: "attack", targetActor: { items: [], system: {}, getFlag: () => undefined } });
    expect(mods).toEqual([]);
  });

  it("не атака (обычный тест Навыка) — бонус не участвует", () => {
    const { mods } = resolveTest({ actor: ally(), kind: "skill", skill: "athletics", targetActor: markedTarget("khorne") });
    expect(mods).toEqual([]);
  });
});

describe("Проклятая Метка через resolveTest: god-ответвления (wdbc-w8z4)", () => {
  it("Кхорн: зверолюд-союзник получает Proven(3) в Особых Свойствах атаки", () => {
    const { weaponProps } = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("khorne") });
    expect(weaponProps).toContainEqual({
      ruleId: "beastmanShaman.hexMarkedPrey.khorneProven",
      label: "Проклятая Метка (Кхорн): Proven(3) на атаке по цели",
      key: "proven", rating: 3, rating2: 0
    });
  });

  it("Нургл: зверолюд-союзник получает Toxic(1) в Особых Свойствах атаки", () => {
    const { weaponProps } = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("nurgle") });
    expect(weaponProps).toContainEqual({
      ruleId: "beastmanShaman.hexMarkedPrey.nurgleToxic",
      label: "Проклятая Метка (Нургл): Toxic(1) на атаке по цели",
      key: "toxic", rating: 1, rating2: 0
    });
  });

  it("Кхорн-метка не даёт Toxic, Нургл-метка не даёт Proven — ветки не путаются", () => {
    const khorne = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("khorne") });
    expect(khorne.weaponProps.some(p => p.key === "toxic")).toBe(false);
    const nurgle = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("nurgle") });
    expect(nurgle.weaponProps.some(p => p.key === "proven")).toBe(false);
  });

  it("Другое Покровительство (Слаанеш/Тзинч) — ни Proven, ни Toxic не даётся", () => {
    const { weaponProps } = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("slaanesh") });
    expect(weaponProps).toEqual([]);
  });

  it("не зверолюд — god-бонуса тоже нет, даже под правильным Покровительством метки", () => {
    const { weaponProps } = resolveTest({ actor: ally("human"), kind: "attack", targetActor: markedTarget("khorne") });
    expect(weaponProps).toEqual([]);
  });

  it("базовый +15 и god-Свойство приходят вместе одним обходом правил", () => {
    const { mods, weaponProps } = resolveTest({ actor: ally(), kind: "attack", targetActor: markedTarget("nurgle") });
    expect(mods).toHaveLength(1);
    expect(weaponProps).toHaveLength(1);
  });
});
