// test/combat/touch-of-pain.test.mjs
//
// Touch of Pain / Касание Боли (Дар Слаанеш, wdbc-1rno): безоружные и
// природные атаки носителя игнорируют T.b Поглощения и получают Shocking.

import { describe, it, expect } from "vitest";
import { touchOfPainActive, TOUCH_OF_PAIN } from "../../module/combat/touch-of-pain.mjs";

function bearer(key = TOUCH_OF_PAIN) {
  const items = key ? [{
    id: "gift", type: "mutation", name: "Touch of Pain",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }] : [];
  return { type: "character", system: {}, items: Object.assign(items.slice(), { contents: items }) };
}

const weapon = integral => ({
  type: "weapon", name: "оружие",
  getFlag: (scope, k) => (scope === "warhammer-dbc" && k === "integralAttack" ? integral : undefined)
});

describe("touchOfPainActive", () => {
  it("удар природным оружием носителя — активен", () => {
    expect(touchOfPainActive(bearer(), weapon(true))).toBe(true);
  });
  it("безоружная атака без предмета вовсе — тоже активен", () => {
    expect(touchOfPainActive(bearer(), null)).toBe(true);
  });
  it("обычное оружие в руке — Дар не действует", () => {
    expect(touchOfPainActive(bearer(), weapon(false))).toBe(false);
  });
  it("нет Дара — не активен при любом оружии", () => {
    expect(touchOfPainActive(bearer(null), weapon(true))).toBe(false);
  });
});
