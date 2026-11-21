// Повелитель Червей (Черта Короля Червей, Разобрать lg5r8).
import { describe, it, expect } from "vitest";
import { hasWormMaster, wormSwarmCap, wormSwarmBonusWounds, sanitizeWormBonus } from "../../module/rules/worm-master.mjs";

describe("Повелитель Червей", () => {
  it("узнаёт Черту и считает предел Cor.b", () => {
    const a = { items: [{ type: "trait", name: "Worm Master / Повелитель Червей" }], system: { corruptionBonus: 3 } };
    expect(hasWormMaster(a)).toBe(true);
    expect(wormSwarmCap(a)).toBe(3);
  });
  it("+10 Ран за каждый Успех после первого", () => {
    expect(wormSwarmBonusWounds(1)).toBe(0);
    expect(wormSwarmBonusWounds(3)).toBe(20);
  });
  it("сокет не принимает произвольные Раны", () => {
    expect(sanitizeWormBonus(25)).toBe(20);
    expect(sanitizeWormBonus(-10)).toBe(0);
    expect(sanitizeWormBonus(500)).toBe(90);
  });
});
