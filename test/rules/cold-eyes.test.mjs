// test/rules/cold-eyes.test.mjs
//
// wdbc-1rno.5 (находка 7/12): hasColdEyes — без Foundry.

import { describe, it, expect } from "vitest";
import { hasColdEyes, COLD_EYES_CAPABILITY } from "../../module/rules/cold-eyes.mjs";

const coldEyesByName = () => ({ type: "gear", name: "Cold Eyes / Холодные Глаза", flags: {} });
const coldEyesByKey = () => ({
  type: "gear", name: "Переименовали в паке",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: COLD_EYES_CAPABILITY }
  ] }] } }
});

describe("hasColdEyes", () => {
  it("находит по имени", () => {
    expect(hasColdEyes({ items: [coldEyesByName()] })).toBe(true);
  });
  it("находит по capabilityKey, даже если имя разошлось", () => {
    expect(hasColdEyes({ items: [coldEyesByKey()] })).toBe(true);
  });
  it("другой тип предмета с тем же именем — false (не gear)", () => {
    expect(hasColdEyes({ items: [{ type: "trait", name: "Cold Eyes / Холодные Глаза", flags: {} }] })).toBe(false);
  });
  it("нет предмета — false, не падает", () => {
    expect(hasColdEyes({ items: [] })).toBe(false);
    expect(hasColdEyes(null)).toBe(false);
  });
});
