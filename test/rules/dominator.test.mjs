// test/rules/dominator.test.mjs

import { describe, it, expect } from "vitest";
import { hasDominator } from "../../module/rules/dominator.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("hasDominator", () => {
  it("находит по билингвальному имени", () => {
    expect(hasDominator(actorWith("Dominator / Покоритель"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasDominator(actorWith("Erudite-Infernal"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasDominator(null)).toBe(false);
  });
});
