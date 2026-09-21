// test/rules/tracking-aim.test.mjs
//
// wdbc-1rno.5: hasTrackingAim — без Foundry.

import { describe, it, expect } from "vitest";
import { hasTrackingAim, TRACKING_AIM_CAPABILITY } from "../../module/rules/tracking-aim.mjs";

const talentByName = () => ({ type: "talent", name: "Tracking Aim / Прицел на Упреждение", flags: {} });
const talentByKey = () => ({
  type: "talent", name: "Переименовали в паке",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: TRACKING_AIM_CAPABILITY }
  ] }] } }
});

describe("hasTrackingAim", () => {
  it("находит Талант по имени", () => {
    expect(hasTrackingAim({ items: [talentByName()] })).toBe(true);
  });
  it("находит по capabilityKey, даже если имя разошлось", () => {
    expect(hasTrackingAim({ items: [talentByKey()] })).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasTrackingAim({ items: [{ type: "talent", name: "Dodge", flags: {} }] })).toBe(false);
  });
  it("пустой актор — false, не падает", () => {
    expect(hasTrackingAim({ items: [] })).toBe(false);
    expect(hasTrackingAim(null)).toBe(false);
  });
});
