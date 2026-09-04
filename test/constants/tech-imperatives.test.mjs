// test/constants/tech-imperatives.test.mjs
//
// module/constants/tech-imperatives.mjs (wdbc-yu32) — числовые бонусы
// Evasion/Fortress Imperative, найденные по имени предмета (itemHasName).

import { describe, it, expect } from "vitest";
import { findTechImperative, TECH_IMPERATIVES } from "../../module/constants/tech-imperatives.mjs";

describe("findTechImperative", () => {
  it("находит Evasion Imperative по имени формата «English / Русский»", () => {
    expect(findTechImperative({ name: "Evasion Imperative / Императив Избегания" })).toMatchObject(TECH_IMPERATIVES["Evasion Imperative"]);
  });

  it("находит Fortress Imperative", () => {
    expect(findTechImperative({ name: "Fortress Imperative / Императив Крепости" })).toMatchObject(TECH_IMPERATIVES["Fortress Imperative"]);
  });

  it("прочие Техночудеса — null", () => {
    expect(findTechImperative({ name: "Noospheric Uplink / Ноосферный Аплинк" })).toBeNull();
  });
});

// wdbc-hdxj: книжный знак «кроме Отскока в укрытие» — фиксированный, не
// следует за отредактированным evasionBonus диалога активации (tech.mjs).
describe("evasionRecoilBonus (wdbc-hdxj)", () => {
  it("Evasion Imperative: −20 (книга: «+до +30 на Избегания, кроме Отскока в укрытие −20»)", () => {
    expect(TECH_IMPERATIVES["Evasion Imperative"].evasionRecoilBonus).toBe(-20);
  });
  it("Fortress Imperative: +20 (книга: «+20 на Отскок в укрытие, но −30 на остальные Избегания»)", () => {
    expect(TECH_IMPERATIVES["Fortress Imperative"].evasionRecoilBonus).toBe(20);
  });
});
