// test/rules/adoring-crowds.test.mjs
//
// Обожание Толпы (Воин Ноты): «Может использовать A вместо F и Trade(Dancer)
// вместо Command для своих Миньонов-Людей» (rules/minion-build.mjs::masterGroupChar).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { masterGroupChar, minionLoyalty, minionCapacity, talentRequirements, adoringCrowdsFreebies, SYCOPHANT_TRAIT_UUID }
  from "../../module/rules/minion-build.mjs";

const master = ({ fel = 30, ag = 50, crowds = true } = {}) => ({
  system: { characteristics: { fel: { total: fel }, ag: { total: ag }, per: { total: 20 }, inf: { total: 10 } } },
  items: crowds ? [{ type: "trait", name: "Adoring Crowds / Обожание Толпы", system: {} }] : [],
  flags: {}
});

describe("Обожание Толпы", () => {
  it("люди: A вместо F, если она выше", () => {
    expect(masterGroupChar(master(), "human")).toEqual({ key: "ag", total: 50 });
    expect(masterGroupChar(master({ fel: 60 }), "human")).toEqual({ key: "fel", total: 60 });
  });
  it("без Черты и у других групп — как обычно", () => {
    expect(masterGroupChar(master({ crowds: false }), "human")).toEqual({ key: "fel", total: 30 });
    expect(masterGroupChar(master(), "beast")).toEqual({ key: "per", total: 20 });
  });
  it("Лояльность и максимум Миньонов-Людей считаются от A", () => {
    expect(minionLoyalty(master(), "human")).toBe(50);
    expect(minionCapacity(master(), ["human"])).toBe(5);
    expect(minionLoyalty(master({ crowds: false }), "human")).toBe(30);
  });
  it("требование Таланта: A и Trade (Dancer) как замена Command", () => {
    const r = talentRequirements(master({ fel: 10, ag: 60 }), "human", "lesser");
    expect(r.ok).toBe(true);
    expect(r.skillNote).toMatch(/Command или Trade \(Dancer\)/);
    expect(talentRequirements(master({ fel: 10, ag: 60, crowds: false }), "human", "lesser").ok).toBe(false);
  });
  it("слуги-Люди получают Sycophant и Trade (Musician) бесплатно, остальные — нет (wdbc-ra2oc)", () => {
    expect(adoringCrowdsFreebies(master(), "human")).toEqual({
      traitUuid: SYCOPHANT_TRAIT_UUID, skill: { scope: "group", key: "trade", spec: "Музыкант" } });
    expect(adoringCrowdsFreebies(master(), "beast")).toBeNull();
    expect(adoringCrowdsFreebies(master({ crowds: false }), "human")).toBeNull();
  });
});
