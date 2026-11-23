// Черты Пакта: Защита Пакта, Испивающий Души (21.11.2026).
import { describe, it, expect } from "vitest";
import { pactProtectionNote, soulDrinkerGains, hasHeartOfStone } from "../../module/rules/pact-traits.mjs";

const pp = { items: [{ name: "Pact Protection / Защита Пакта (Мейстер)", type: "trait" }] };

describe("Черты Пакта", () => {
  it("Защита Пакта: строка только для Телепатии по носителю", () => {
    expect(pactProtectionNote(pp, "telepathy")).toMatch(/ложь/);
    expect(pactProtectionNote(pp, "biomancy")).toBe("");
    expect(pactProtectionNote({ items: [] }, "telepathy")).toBe("");
  });
  it("Испивающий Души: ½W.b окр.▲ Жажды, 2×W.b Ран, 4×W.b Характеристик", () => {
    expect(soulDrinkerGains(5)).toEqual({ thirst: 3, heal: 10, charHeal: 20, traits: 5 });
  });
  it("Каменное Сердце опознаётся по имени", () => {
    expect(hasHeartOfStone({ items: [{ name: "Heart of Stone / Каменное Сердце", type: "trait" }] })).toBe(true);
  });
});
