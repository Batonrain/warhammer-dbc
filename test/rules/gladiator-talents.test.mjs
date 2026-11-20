// Димахер: +Момент к урону с двумя рукопашными (20.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { dimacherusBonus } from "../../module/rules/gladiator-talents.mjs";

const melee = id => ({ id, type: "weapon", system: { weaponClass: "melee", equipped: true } });
const gladiator = weapons => ({ items: [{ type: "talent", name: "Dimacherus / Димахер" }, ...weapons], system: { hands: {} } });

describe("Димахер", () => {
  it("без Таланта или в стрельбе — ноль", () => {
    expect(dimacherusBonus({ items: [] }, { isMelee: true, momentum: 3 })).toBe(0);
    expect(dimacherusBonus(gladiator([melee("a"), melee("b")]), { isMelee: false, momentum: 3 })).toBe(0);
    expect(dimacherusBonus(gladiator([melee("a"), melee("b")]), { isMelee: true, momentum: 0 })).toBe(0);
  });
});

describe("Димахер: две рукопашных в руках", () => {
  it("+Момент к урону", () => {
    expect(dimacherusBonus(gladiator([melee("a"), melee("b")]), { isMelee: true, momentum: 3 })).toBe(3);
    expect(dimacherusBonus(gladiator([melee("a")]), { isMelee: true, momentum: 3 })).toBe(0);
  });
});
