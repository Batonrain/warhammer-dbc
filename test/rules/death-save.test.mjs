// test/rules/death-save.test.mjs
//
// Смерть (стр. 232-233): Чудесное Спасение / Божественная Защита / Замедленная
// Анимация — доступность и стоимость. Чистые функции, никакого броска здесь.

import { describe, it, expect } from "vitest";
import {
  fatePoolLabel, hasDivineProtectionTalent, hasSusAnMembrane, susAnEligible,
  fateSaveFails, toyOfGodsApplies, SUS_AN_MIN_CRITICAL
} from "../../module/rules/death-save.mjs";

describe("fatePoolLabel", () => {
  it("лоялист платит Судьбой", () => {
    expect(fatePoolLabel({ system: { alignment: "loyalist" } })).toBe("Судьбы");
  });
  it("хаосит платит Бесчестьем", () => {
    expect(fatePoolLabel({ system: { alignment: "heretic" } })).toBe("Бесчестья");
  });
});

describe("hasDivineProtectionTalent", () => {
  it("находит Талант по имени", () => {
    const actor = { items: [{ type: "talent", name: "Divine Protection / Божественная Защита" }] };
    expect(hasDivineProtectionTalent(actor)).toBe(true);
  });
  it("не находит без Таланта", () => {
    const actor = { items: [{ type: "talent", name: "Iron Discipline" }] };
    expect(hasDivineProtectionTalent(actor)).toBe(false);
  });
});

describe("hasSusAnMembrane", () => {
  it("требует и имя, и флаг installed", () => {
    const installed = { type: "implant", name: "Сус-ан Мембрана", getFlag: () => true };
    const notInstalled = { type: "implant", name: "Сус-ан Мембрана", getFlag: () => false };
    expect(hasSusAnMembrane({ items: [installed] })).toBe(true);
    expect(hasSusAnMembrane({ items: [notInstalled] })).toBe(false);
  });
});

describe("susAnEligible", () => {
  it("доступна ровно на границе −15", () => {
    expect(susAnEligible({ system: { wounds: { critical: SUS_AN_MIN_CRITICAL } } })).toBe(true);
    expect(susAnEligible({ system: { wounds: { critical: SUS_AN_MIN_CRITICAL + 1 } } })).toBe(false);
  });
});

describe("fateSaveFails", () => {
  it("проваливается, если пул опустится до 0 или ниже", () => {
    expect(fateSaveFails(20, 20)).toBe(true);
    expect(fateSaveFails(20, 25)).toBe(true);
    expect(fateSaveFails(20, 19)).toBe(false);
  });
});

describe("toyOfGodsApplies", () => {
  it("только у хаоситов", () => {
    expect(toyOfGodsApplies({ system: { alignment: "heretic" } })).toBe(true);
    expect(toyOfGodsApplies({ system: { alignment: "loyalist" } })).toBe(false);
  });
});
