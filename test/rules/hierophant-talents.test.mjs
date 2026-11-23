// Иерофант: Великий Агитатор, Владыка Масс, Кровь Мучеников, Град, Живая Волна (21.11.2026).
import { describe, it, expect } from "vitest";
import {
  agitatorMagnitude, agitatorHordeActive, bloodOfMartyrsNote, masterOfMassesCommandBonus,
  masterOfMassesPsychDamage, masterOfMassesMagnitudeBoost, hailBonus, livingTide, mobJusticeHeal
} from "../../module/rules/hierophant-talents.mjs";
import { commandSubstitutionRules } from "../../module/rules/command-substitution.mjs";

const item = (name, type) => ({ name, type });
const actor = (items, extra = {}) => ({ items, flags: {}, system: {}, ...extra });

describe("Иерофант", () => {
  it("Агитатор: 10 × Успехи, срок по worldTime", () => {
    expect(agitatorMagnitude(3)).toBe(30);
    expect(agitatorMagnitude(3, false)).toBe(0);
    const a = actor([], { flags: { "warhammer-dbc": { agitatorHorde: { magnitude: 30, until: 100 } } } });
    expect(agitatorHordeActive(a, 50)?.magnitude).toBe(30);
    expect(agitatorHordeActive(a, 100)).toBeNull();
  });
  it("Кровь Мучеников: только не-Избирательные и при живой Орде", () => {
    const a = actor([item("Blood of Martyrs / Кровь Мучеников", "talent")],
      { flags: { "warhammer-dbc": { agitatorHorde: { magnitude: 20, until: 1000 } } } });
    expect(bloodOfMartyrsNote(a, { worldTime: 10 })).toMatch(/Орду/);
    expect(bloodOfMartyrsNote(a, { selective: true, worldTime: 10 })).toBe("");
    expect(bloodOfMartyrsNote(a, { worldTime: 2000 })).toBe("");
    expect(bloodOfMartyrsNote(actor([]), { worldTime: 10 })).toBe("");
  });
  it("Владыка Масс: Charm вместо Command только для Орды, не хуже обычного", () => {
    const a = actor([item("Master of Masses / Владыка Масс", "trait")],
      { system: { skills: { charm: { total: 55 }, command: { total: 40 } } } });
    expect(masterOfMassesCommandBonus(a, { targetActor: { type: "horde" } })).toBe(15);
    expect(masterOfMassesCommandBonus(a, { targetActor: { type: "character" } })).toBe(0);
    const rules = commandSubstitutionRules(a, { targetActor: { type: "horde" } });
    expect(rules[0].id).toBe("masterOfMasses.command");
    expect(rules[0].effects[0].value).toBe(15);
    expect(masterOfMassesPsychDamage(7)).toBe(4);
    expect(masterOfMassesMagnitudeBoost(45, 30)).toBe(23);
    expect(masterOfMassesMagnitudeBoost(45, 10)).toBe(10);
  });
  it("Град и Живая Волна", () => {
    expect(hailBonus(5)).toEqual({ sacrificed: 3, hit: 30, dice: "3d10" });
    const t = livingTide({ magnitude: 30, successes: 6 });
    expect(t.athleticsBonus).toBe(50);
    expect(t.moveKg).toBe(3000);
    expect(t.selfDamage).toBe("1d5+3");
    expect(livingTide({ magnitude: 30, successes: 3 }).ok).toBe(false);
    expect(mobJusticeHeal(2)).toBe("2d10+2");
  });
});
