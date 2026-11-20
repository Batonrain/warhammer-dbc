// Общая Боль (Разобрать hzn79).
import { describe, it, expect } from "vitest";
import { sharedPainApplies } from "../../module/combat/shared-pain.mjs";

const actor = (manifested, talent = "Shared Pain / Общая Боль") => ({
  system: { possession: { manifested } }, items: talent ? [{ type: "talent", name: talent, system: {} }] : []
});
describe("Общая Боль", () => {
  it("только в Проявлении, с Талантом и при уроне больше 1", () => {
    expect(sharedPainApplies(actor(true), 5)).toBe(true);
    expect(sharedPainApplies(actor(false), 5)).toBe(false);
    expect(sharedPainApplies(actor(true, ""), 5)).toBe(false);
    expect(sharedPainApplies(actor(true), 1)).toBe(false);
  });
});
