// test/rules/electrovigour.test.mjs

import { describe, it, expect } from "vitest";
import { hasElectrovigour } from "../../module/rules/electrovigour.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("hasElectrovigour", () => {
  it("находит по билингвальному имени", () => {
    expect(hasElectrovigour(actorWith("Electrovigour / Электрорвение"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasElectrovigour(actorWith("Tech-Use"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasElectrovigour(null)).toBe(false);
  });
});
