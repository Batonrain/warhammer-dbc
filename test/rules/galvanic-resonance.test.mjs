// Гальванический Резонанс: T.b и АР участков попадания на карточке (20.11.2026).
import { describe, it, expect } from "vitest";
import { galvanicResonanceOn, galvanicResonanceText } from "../../module/rules/gunsmith-talents.mjs";
const LOCATION_TO_ARMOR = { "Голова": "head", "Торс": "body" };

const shooter = { items: [{ type: "talent", name: "Galvanic Resonance / Гальванический Резонанс" }] };
const rifle = { name: "Galvanic Rifle / Гальваническая Винтовка", system: {} };

describe("Гальванический Резонанс", () => {
  it("только попадание Гальваническим после прицеливания", () => {
    expect(galvanicResonanceOn(shooter, { item: rifle, isMelee: false, hit: true, aimed: true })).toBe(true);
    expect(galvanicResonanceOn(shooter, { item: rifle, isMelee: false, hit: true, aimed: false })).toBe(false);
    expect(galvanicResonanceOn(shooter, { item: { name: "Lasgun" }, isMelee: false, hit: true, aimed: true })).toBe(false);
    expect(galvanicResonanceOn({ items: [] }, { item: rifle, isMelee: false, hit: true, aimed: true })).toBe(false);
  });
  it("AP без T.b и щит отдельно, участки без повторов", () => {
    const abs = { toughnessBonus: 4, head: 9, body: 12, noShield: { head: 9, body: 10 } };
    expect(galvanicResonanceText(abs, ["Голова", "Торс", "Торс"], LOCATION_TO_ARMOR))
      .toBe("⚡ Гальванический Резонанс: у цели T.b 4; Голова: АР 5; Торс: АР 6 + щит 2.");
  });
});
