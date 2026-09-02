// test/rules/determination-to-fight.test.mjs

import { describe, it, expect } from "vitest";
import { hasDeterminationToFight, determinationToFightReduction } from "../../module/rules/determination-to-fight.mjs";

const actorWith = (tier, wpBonus, ...talentNames) => ({
  system: { wounds: { tier }, characteristics: { wp: { bonus: wpBonus } } },
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("hasDeterminationToFight", () => {
  it("находит по билингвальному имени", () => {
    expect(hasDeterminationToFight(actorWith("dying", 4, "Determination To Fight / Решительность Сражаться"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasDeterminationToFight(actorWith("dying", 4, "Dodge"))).toBe(false);
  });
});

describe("determinationToFightReduction", () => {
  it("Талант + dying — WP.b", () => {
    expect(determinationToFightReduction(actorWith("dying", 4, "Determination To Fight / Решительность Сражаться"))).toBe(4);
  });
  it("минимум 1, даже при WP.b=0", () => {
    expect(determinationToFightReduction(actorWith("dying", 0, "Determination To Fight / Решительность Сражаться"))).toBe(1);
  });
  it("не dying — 0", () => {
    expect(determinationToFightReduction(actorWith("heavy", 4, "Determination To Fight / Решительность Сражаться"))).toBe(0);
  });
  it("нет Таланта — 0", () => {
    expect(determinationToFightReduction(actorWith("dying", 4))).toBe(0);
  });
  it("нет актора — 0, не падает", () => {
    expect(determinationToFightReduction(null)).toBe(0);
  });
});
