// test/rules/throwing-cooking.test.mjs
// 3-8318, Grenade Cooking / Выдержка Гранаты.
import { describe, it, expect } from "vitest";
import { grenadeCookingApplies, grenadeCookingOffered, grenadeCookingDodgePenalty } from "../../module/rules/throwing-talents.mjs";

const TALENT = { type: "talent", name: "Grenade Cooking / Выдержка Гранаты", system: {} };
const has = { items: [TALENT] };
const grenade = { weaponClass: "thrown", weaponType: "grenade" };

describe("grenadeCookingOffered / Applies", () => {
  it("граната у носителя Таланта — галочка предлагается", () => {
    expect(grenadeCookingOffered(has, { sys: grenade })).toBe(true);
  });
  it("не граната (нож, бомба), не метательное, рукопашное применение, нет Таланта — не предлагается", () => {
    expect(grenadeCookingOffered(has, { sys: { weaponClass: "thrown", weaponType: "lowtech" } })).toBe(false);
    expect(grenadeCookingOffered(has, { sys: { weaponClass: "thrown", weaponType: "explosive" } })).toBe(false);
    expect(grenadeCookingOffered(has, { sys: { weaponClass: "basic", weaponType: "grenade" } })).toBe(false);
    expect(grenadeCookingOffered(has, { sys: grenade, isMelee: true })).toBe(false);
    expect(grenadeCookingOffered({ items: [] }, { sys: grenade })).toBe(false);
  });
  it("тест идёт только при включённой галочке", () => {
    expect(grenadeCookingApplies(has, { sys: grenade, toggles: { grenadeCooking: true } })).toBe(true);
    expect(grenadeCookingApplies(has, { sys: grenade, toggles: {} })).toBe(false);
    expect(grenadeCookingApplies({ items: [] }, { sys: grenade, toggles: { grenadeCooking: true } })).toBe(false);
  });
});

describe("grenadeCookingDodgePenalty", () => {
  it("−5 за каждый Успех", () => {
    expect(grenadeCookingDodgePenalty({ success: true, deg: 1 })).toBe(-5);
    expect(grenadeCookingDodgePenalty({ success: true, deg: 4 })).toBe(-20);
  });
  it("Провал, нет теста — 0", () => {
    expect(grenadeCookingDodgePenalty({ success: false, deg: 3 })).toBe(0);
    expect(grenadeCookingDodgePenalty(null)).toBe(0);
    expect(grenadeCookingDodgePenalty(undefined)).toBe(0);
  });
});
