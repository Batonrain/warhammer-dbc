// test/rules/aim-focus.test.mjs
//
// wdbc-1rno.5: hasAimFocus — без Foundry.

import { describe, it, expect } from "vitest";
import { hasAimFocus, AIM_FOCUS_CAPABILITY } from "../../module/rules/aim-focus.mjs";

const talentByName = () => ({ type: "talent", name: "Aim Focus / Фокус на Прицеле", flags: {} });
const talentByKey = () => ({
  type: "talent", name: "Переименовали в паке",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: AIM_FOCUS_CAPABILITY }
  ] }] } }
});

describe("hasAimFocus", () => {
  it("находит Талант по имени", () => {
    expect(hasAimFocus({ items: [talentByName()] })).toBe(true);
  });
  it("находит по capabilityKey, даже если имя разошлось", () => {
    expect(hasAimFocus({ items: [talentByKey()] })).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasAimFocus({ items: [{ type: "talent", name: "Dodge", flags: {} }] })).toBe(false);
  });
  it("пустой актор — false, не падает", () => {
    expect(hasAimFocus({ items: [] })).toBe(false);
    expect(hasAimFocus(null)).toBe(false);
  });
});
