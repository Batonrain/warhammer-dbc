// test/rules/armour-training.test.mjs
//
// Armour Training / Тренировка в Броне (Арсенал, стр. 62, wdbc-3-65ff):
// +10 Max.A этого вида брони, −5 её штрафа к A (если есть), по специализации
// купленного Таланта — тот же паттерн чтения, что у Melee/Weapon Training.

import { describe, it, expect } from "vitest";
import { hasArmourTraining, armourTrainingAgilityBonus, armourTrainingPenaltyReduction }
  from "../../module/rules/armour-training.mjs";

const talent = (specialization) => ({
  type: "talent", name: "Armour Training / Тренировка в Броне", system: { specialization }
});

const actor = (items = []) => ({ items });

describe("hasArmourTraining", () => {
  it("без Таланта — не владеет ничем", () => {
    expect(hasArmourTraining(actor(), "power")).toBe(false);
  });

  it("специализация «силовая» покрывает только armorType power", () => {
    const a = actor([talent("силовая")]);
    expect(hasArmourTraining(a, "power")).toBe(true);
    expect(hasArmourTraining(a, "flak")).toBe(false);
  });

  it("регистр и пробелы специализации не важны", () => {
    const a = actor([talent("  Силовая ")]);
    expect(hasArmourTraining(a, "power")).toBe(true);
  });

  it("несколько специализаций через запятую (непорезолвленный шаблон)", () => {
    const a = actor([talent("Примитивная, флак, панцирная")]);
    expect(hasArmourTraining(a, "simple")).toBe(true);
    expect(hasArmourTraining(a, "flak")).toBe(true);
    expect(hasArmourTraining(a, "carapace")).toBe(true);
    expect(hasArmourTraining(a, "power")).toBe(false);
  });

  it("«экзотическая» не совпадает ни с одним armorType — честный пробел", () => {
    const a = actor([talent("экзотическая")]);
    expect(hasArmourTraining(a, "power")).toBe(false);
    expect(hasArmourTraining(a, "exotic")).toBe(false);
  });

  it("mesh/aspect книжный список специализаций не упоминает вовсе", () => {
    const a = actor([talent("Примитивная, флак, панцирная, силовая, экзотическая")]);
    expect(hasArmourTraining(a, "mesh")).toBe(false);
    expect(hasArmourTraining(a, "aspect")).toBe(false);
  });

  it("без armorType — не владеет", () => {
    expect(hasArmourTraining(actor([talent("силовая")]), "")).toBe(false);
  });
});

describe("armourTrainingAgilityBonus / armourTrainingPenaltyReduction", () => {
  it("без специализации под этот armorType — 0", () => {
    const a = actor([talent("флак")]);
    expect(armourTrainingAgilityBonus(a, "power")).toBe(0);
    expect(armourTrainingPenaltyReduction(a, "power")).toBe(0);
  });

  it("со специализацией — +10 Max.A и −5 штрафа", () => {
    const a = actor([talent("силовая")]);
    expect(armourTrainingAgilityBonus(a, "power")).toBe(10);
    expect(armourTrainingPenaltyReduction(a, "power")).toBe(5);
  });
});
