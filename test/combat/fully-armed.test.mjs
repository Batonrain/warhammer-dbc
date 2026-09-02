// test/combat/fully-armed.test.mjs
//
// Fully Armed / Во Всеоружии (wdbc-1rno): не-тяжёлое стрелковое оружие с
// установленным Custom Grip («Персональный Хват»/Personal Grip) даёт
// +1 Надёжность и ½ веса (окр.▼) в расчёте Разгрузки — только если у актора
// есть сама Черта. Мод определяется по русской половине имени (обе пак-формы:
// «Personal Grip / Персональный Хват» и «Personal Grip (Melee) / Персональный
// Хват (рукопашное)» — скобка отбрасывается itemHasName).

import { describe, it, expect } from "vitest";
import {
  hasFullyArmed, hasCustomGrip, fullyArmedReliabilityBonus, fullyArmedWeight
} from "../../module/combat/fully-armed.mjs";

function weapon(id, weaponClass, weight = 1.2) {
  return { id, type: "weapon", system: { weaponClass, weight } };
}

function customGripMod(installedOn, melee = false) {
  return {
    type: "weaponMod",
    name: melee ? "Personal Grip (Melee) / Персональный Хват (рукопашное)" : "Personal Grip / Персональный Хват",
    system: { installedOn }
  };
}

function actorWith(items) {
  const list = [...items];
  return { items: list };
}

describe("hasFullyArmed", () => {
  it("находит Черту по имени", () => {
    expect(hasFullyArmed(actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }]))).toBe(true);
  });
  it("нет Черты — false", () => {
    expect(hasFullyArmed(actorWith([{ type: "trait", name: "Dodge" }]))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasFullyArmed(null)).toBe(false);
  });
});

describe("hasCustomGrip", () => {
  it("находит установленный мод по русской половине имени (стрелковый вариант)", () => {
    const a = actorWith([customGripMod("w1")]);
    expect(hasCustomGrip(a, weapon("w1", "pistol"))).toBe(true);
  });

  it("находит установленный мод (рукопашный вариант, со скобкой)", () => {
    const a = actorWith([customGripMod("w1", true)]);
    expect(hasCustomGrip(a, weapon("w1", "melee"))).toBe(true);
  });

  it("мод установлен на ДРУГОЕ оружие — не считается", () => {
    const a = actorWith([customGripMod("w2")]);
    expect(hasCustomGrip(a, weapon("w1", "pistol"))).toBe(false);
  });

  it("другой мод с другим именем — не считается", () => {
    const a = actorWith([{ type: "weaponMod", name: "Reinforced / Укреплённое", system: { installedOn: "w1" } }]);
    expect(hasCustomGrip(a, weapon("w1", "pistol"))).toBe(false);
  });
});

describe("fullyArmedReliabilityBonus", () => {
  it("Черта + мод + не-тяжёлое стрелковое — +1", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod("w1")]);
    expect(fullyArmedReliabilityBonus(a, weapon("w1", "basic"))).toBe(1);
  });

  it("нет Черты — 0, даже с модом", () => {
    const a = actorWith([customGripMod("w1")]);
    expect(fullyArmedReliabilityBonus(a, weapon("w1", "pistol"))).toBe(0);
  });

  it("Черта есть, мода нет — 0", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }]);
    expect(fullyArmedReliabilityBonus(a, weapon("w1", "pistol"))).toBe(0);
  });

  it("тяжёлое оружие — 0, даже с Чертой и модом", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod("w1")]);
    expect(fullyArmedReliabilityBonus(a, weapon("w1", "heavy"))).toBe(0);
  });

  it("рукопашное оружие — 0 (Надёжность только для стрелкового)", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod("w1", true)]);
    expect(fullyArmedReliabilityBonus(a, weapon("w1", "melee"))).toBe(0);
  });
});

describe("fullyArmedWeight", () => {
  it("Черта + мод + не-тяжёлое стрелковое — вес пополам, окр.▼ до 0.1", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod("w1")]);
    expect(fullyArmedWeight(a, weapon("w1", "pistol"), 1.2)).toBeCloseTo(0.6, 5);
    expect(fullyArmedWeight(a, weapon("w1", "basic"), 0.8)).toBeCloseTo(0.4, 5);
  });

  it("нечётный остаток округляется вниз, не обнуляет лёгкое оружие", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod("w1")]);
    // 0.85 / 2 = 0.425 → окр.▼ до 0.1 = 0.4 (не 0)
    expect(fullyArmedWeight(a, weapon("w1", "pistol"), 0.85)).toBeCloseTo(0.4, 5);
  });

  it("нет Черты — вес не меняется", () => {
    const a = actorWith([customGripMod("w1")]);
    expect(fullyArmedWeight(a, weapon("w1", "pistol"), 1.2)).toBe(1.2);
  });

  it("тяжёлое оружие — вес не меняется", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }, customGripMod("w1")]);
    expect(fullyArmedWeight(a, weapon("w1", "heavy"), 3)).toBe(3);
  });

  it("не-weapon предмет (gear/ammo) — вес не меняется, не падает", () => {
    const a = actorWith([{ type: "trait", name: "Fully Armed / Во Всеоружии" }]);
    const gear = { id: "g1", type: "gear", system: { weight: 2 } };
    expect(fullyArmedWeight(a, gear, 2)).toBe(2);
  });
});
