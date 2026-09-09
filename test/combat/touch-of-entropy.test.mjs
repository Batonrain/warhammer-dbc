// test/combat/touch-of-entropy.test.mjs
//
// Касание Энтропии (Дар Нургла, wdbc-1rno): безоружные и природные атаки
// съедают AP места попадания ДО расчёта поглощения.

import { describe, it, expect } from "vitest";
import {
  touchOfEntropyRating, attackEntropyRating, entropyArmourLoss, TOUCH_OF_ENTROPY
} from "../../module/combat/touch-of-entropy.mjs";

function bearer(key = TOUCH_OF_ENTROPY, corB = 5) {
  const items = key ? [{
    id: "gift", type: "mutation", name: "Touch of Entropy",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }] : [];
  return { type: "character", system: { corruptionBonus: corB },
           items: Object.assign(items.slice(), { contents: items }) };
}

const weapon = integral => ({
  type: "weapon", name: "оружие",
  getFlag: (scope, k) => (scope === "warhammer-dbc" && k === "integralAttack" ? integral : undefined)
});

describe("touchOfEntropyRating", () => {
  it("½ Cor.b с округлением ВВЕРХ («окр.▲» книги)", () => {
    expect(touchOfEntropyRating(5)).toBe(3);
    expect(touchOfEntropyRating(4)).toBe(2);
    expect(touchOfEntropyRating(1)).toBe(1);
  });
  it("Порчи нет — рейтинга нет", () => {
    expect(touchOfEntropyRating(0)).toBe(0);
    expect(touchOfEntropyRating(-3)).toBe(0);
  });
});

describe("attackEntropyRating", () => {
  it("удар природным оружием носителя — рейтинг есть", () => {
    expect(attackEntropyRating(bearer(), weapon(true))).toBe(3);
  });
  it("безоружная атака без предмета вовсе — тоже считается", () => {
    expect(attackEntropyRating(bearer(), null)).toBe(3);
  });
  it("обычное оружие в руке — Дар не действует", () => {
    expect(attackEntropyRating(bearer(), weapon(false))).toBe(0);
  });
  it("нет Дара — 0 при любом оружии", () => {
    expect(attackEntropyRating(bearer(null), weapon(true))).toBe(0);
  });
});

describe("entropyArmourLoss", () => {
  it("брони хватает — съедается весь рейтинг", () => {
    expect(entropyArmourLoss(7, 3)).toBe(3);
  });
  it("брони меньше рейтинга — съедается только наличное, остаток пропадает", () => {
    expect(entropyArmourLoss(2, 3)).toBe(2);
  });
  it("брони нет — есть нечего", () => {
    expect(entropyArmourLoss(0, 3)).toBe(0);
  });
});
