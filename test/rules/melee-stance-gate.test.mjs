// test/rules/melee-stance-gate.test.mjs
//
// Стойки на вкладке БОЙ (панель «Стойка», вне диалога атаки) показывали
// ВСЕ Стойки без фильтра по оружию/Балансу/Тренировке/пешему бою — в отличие
// от того же выбора в диалоге атаки (module/sheets/attack/selection.mjs::
// computeStanceOptions), который эти условия уже проверял. meleeStanceAllowed
// — общая логика для обоих мест (стр. 14-15, стр. 62 Melee Training).

import { describe, it, expect } from "vitest";
import { meleeStanceAllowed } from "../../module/rules/melee-stance-gate.mjs";

const weapon = (system = {}) => ({
  type: "weapon", system: { equipped: true, weaponClass: "melee", ...system }
});

const talent = (specialization) => ({
  type: "talent", name: "Melee Training / Рукопашная Тренировка", system: { specialization }
});

const actor = ({ items = [], mount, movement } = {}) => ({
  items, system: { mount, movement }
});

describe("meleeStanceAllowed", () => {
  it("Стандартная доступна всегда, даже без оружия/Тренировки", () => {
    expect(meleeStanceAllowed(actor(), "standard")).toBe(true);
  });

  it("Агрессивная/Защитная/Прикрывающая — нужна Тренировка на категорию оружия (стр. 62)", () => {
    const untrainedSword = actor({ items: [weapon({ meleeCategory: "Меч" })] });
    expect(meleeStanceAllowed(untrainedSword, "aggressive")).toBe(false);
    expect(meleeStanceAllowed(untrainedSword, "defensive")).toBe(false);
    expect(meleeStanceAllowed(untrainedSword, "covering")).toBe(false);

    const trainedSword = actor({ items: [weapon({ meleeCategory: "Меч" }), talent("Меч")] });
    expect(meleeStanceAllowed(trainedSword, "aggressive")).toBe(true);
    expect(meleeStanceAllowed(trainedSword, "defensive")).toBe(true);
    expect(meleeStanceAllowed(trainedSword, "covering")).toBe(true);
  });

  it("Частокол — только с Глефой/Копьём/Штыком, не с Мечом", () => {
    const withSword = actor({ items: [weapon({ meleeCategory: "Меч" }), talent("Меч")] });
    expect(meleeStanceAllowed(withSword, "rapidstrike")).toBe(false);

    const withSpear = actor({ items: [weapon({ meleeCategory: "Копьё" }), talent("Копьё")] });
    expect(meleeStanceAllowed(withSpear, "rapidstrike")).toBe(true);
  });

  it("Частокол недоступен вовсе без оружия (категория неизвестна — strictCategory не даёт мягкого пропуска)", () => {
    expect(meleeStanceAllowed(actor(), "rapidstrike")).toBe(false);
  });

  it("Пружинящая — нужен Баланс не ниже 0", () => {
    const negBalance = actor({ items: [weapon({ meleeCategory: "Нож", balance: -1 }), talent("Нож")] });
    expect(meleeStanceAllowed(negBalance, "springing")).toBe(false);

    const okBalance = actor({ items: [weapon({ meleeCategory: "Нож", balance: 0 }), talent("Нож")] });
    expect(meleeStanceAllowed(okBalance, "springing")).toBe(true);
  });

  it("Стойки — только в пешем бою: верхом доступна лишь Стандартная", () => {
    const mounted = actor({ items: [weapon({ meleeCategory: "Меч" }), talent("Меч")], mount: { uuid: "Actor.x" } });
    expect(meleeStanceAllowed(mounted, "standard")).toBe(true);
    expect(meleeStanceAllowed(mounted, "aggressive")).toBe(false);
  });

  it("Стойки — в полёте (altitude low/high) тоже только Стандартная", () => {
    const flying = actor({ items: [weapon({ meleeCategory: "Меч" }), talent("Меч")], movement: { altitude: "low" } });
    expect(meleeStanceAllowed(flying, "standard")).toBe(true);
    expect(meleeStanceAllowed(flying, "aggressive")).toBe(false);
  });
});
