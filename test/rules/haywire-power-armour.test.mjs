// test/rules/haywire-power-armour.test.mjs
// Sahara haywire-b895: «отключенная эффектом Haywire» силовая броня — Мёртвая Зона (7+) выключает её.
import { describe, it, expect } from "vitest";
import { powerArmourKilledByHaywire, hasDisabledPowerArmour } from "../../module/rules/armour-penalty.mjs";

const pa = (extra = {}) => ({ id: "PA", type: "armor", name: "Силовая", system: { equipped: true, armorType: "power", active: true, ...extra } });
const actor = (...items) => ({ items });

describe("Haywire выключает силовую броню", () => {
  it("Мёртвая Зона (7) и выше — надетая включённая силовая броня в списке на выключение", () => {
    expect(powerArmourKilledByHaywire(actor(pa()), 7).map(i => i.id)).toEqual(["PA"]);
    expect(powerArmourKilledByHaywire(actor(pa()), 11)).toHaveLength(1);
  });
  it("Сильное Нарушение (6) и ниже — броня работает", () => {
    expect(powerArmourKilledByHaywire(actor(pa()), 6)).toEqual([]);
  });
  it("уже выключенная, не надетая или не силовая — не трогается", () => {
    expect(powerArmourKilledByHaywire(actor(pa({ active: false })), 9)).toEqual([]);
    expect(powerArmourKilledByHaywire(actor(pa({ equipped: false })), 9)).toEqual([]);
    expect(powerArmourKilledByHaywire(actor(pa({ armorType: "carapace" })), 9)).toEqual([]);
  });
  it("после выключения броня считается выключенной общим путём штрафов", () => {
    expect(hasDisabledPowerArmour(actor(pa({ active: false })))).toBe(true);
  });
});
