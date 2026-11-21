// Чемпион Терминатор: Помазанник, Поглотитель, Фениксиец, Саван Смерти (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  anointedShieldBonus, devourerGrappleSize, isPolearm, phoenicianMainProfile, deathShroudDamageFormula
} from "../../module/rules/terminator-talents.mjs";

const talent = name => ({ type: "talent", name });
const spear = { type: "weapon", name: "Spear", system: { meleeCategory: "Копьё", damage: "1d10+3" } };
const sword = { type: "weapon", name: "Sword", system: { meleeCategory: "Меч", damage: "1d10" } };

describe("Чемпион Терминатор", () => {
  it("Помазанник: +35 к щиту только с меткой", () => {
    expect(anointedShieldBonus({ flags: { "warhammer-dbc": { anointedShield: true } } })).toBe(35);
    expect(anointedShieldBonus({ flags: {} })).toBe(0);
  });
  it("Поглотитель: +1 Размер в Борьбе", () => {
    expect(devourerGrappleSize({ items: [talent("Devourer / Поглотитель")] })).toBe(1);
    expect(devourerGrappleSize({ items: [] })).toBe(0);
  });
  it("Фениксиец: только древковое и только с Талантом", () => {
    const a = { items: [talent("Phoenician / Фениксиец")] };
    expect(isPolearm(spear)).toBe(true);
    expect(phoenicianMainProfile(a, spear)).toBe(true);
    expect(phoenicianMainProfile(a, sword)).toBe(false);
    expect(phoenicianMainProfile({ items: [] }, spear)).toBe(false);
  });
  it("Саван Смерти: урон оружия + S.b", () => {
    expect(deathShroudDamageFormula({ system: { characteristics: { s: { bonus: 8 } } } }, spear)).toBe("1d10+3 + 8");
  });
});
