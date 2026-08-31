// test/combat/through-shot.test.mjs
//
// Выстрел Насквозь (стр. 74 Книги Аэльдари): пробивает укрытие/цель, если
// AP+T.b < Pen×2, урон следующей цели снижается по цепочке −1d10 → −1d5 → −1.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { throughShotPierces, throughShotReductionDie, findThroughShotTarget } from "../../module/combat/through-shot.mjs";

function token({ x = 0, y = 0, width = 1, height = 1, id = "" } = {}) {
  return { id, actor: {}, document: { x, y, width, height, rotation: 0 } };
}

describe("throughShotPierces", () => {
  it("AP+T.b меньше Pen×2 — пробивает", () => {
    expect(throughShotPierces(6, 4, 6)).toBe(true); // 10 < 12
  });
  it("AP+T.b равно Pen×2 — не пробивает (строгое меньше)", () => {
    expect(throughShotPierces(6, 6, 6)).toBe(false); // 12 == 12
  });
  it("AP+T.b больше Pen×2 — не пробивает", () => {
    expect(throughShotPierces(10, 6, 6)).toBe(false); // 16 > 12
  });
  it("нулевые значения безопасны", () => {
    expect(throughShotPierces(0, 0, 1)).toBe(true); // 0 < 2
    expect(throughShotPierces(0, 0, 0)).toBe(false); // 0 < 0 false
  });
});

describe("throughShotReductionDie: цепочка 1d10 → 1d5 → флэт", () => {
  it("первое пробитие — 1d10", () => {
    expect(throughShotReductionDie(1)).toBe("1d10");
  });
  it("второе пробитие — 1d5", () => {
    expect(throughShotReductionDie(2)).toBe("1d5");
  });
  it("третье и далее — null (флэт −1, без броска)", () => {
    expect(throughShotReductionDie(3)).toBeNull();
    expect(throughShotReductionDie(4)).toBeNull();
  });
});

describe("findThroughShotTarget — геометрия «следующей цели по линии огня» (wdbc-wlwf)", () => {
  beforeEach(() => {
    globalThis.canvas = { grid: { size: 100 } };
  });

  it("находит токен на продолжении луча стрелок→цель, дальше цели", () => {
    const attacker = token({ x: 0, y: 0,   id: "attacker" });
    const target    = token({ x: 0, y: 100, id: "target" });
    const behind    = token({ x: 0, y: 200, id: "behind" });
    expect(findThroughShotTarget(attacker, target, [attacker, target, behind])).toBe(behind);
  });

  it("токен перед целью (между стрелком и целью) не выбирается", () => {
    const attacker = token({ x: 0, y: 0 });
    const target    = token({ x: 0, y: 200 });
    const between   = token({ x: 0, y: 100 });
    expect(findThroughShotTarget(attacker, target, [between])).toBeNull();
  });

  it("никого позади по линии огня — null", () => {
    const attacker = token({ x: 0, y: 0 });
    const target    = token({ x: 0, y: 100 });
    expect(findThroughShotTarget(attacker, target, [])).toBeNull();
  });

  it("токен далеко в стороне от линии — вне коридора, не выбирается", () => {
    const attacker = token({ x: 0, y: 0 });
    const target    = token({ x: 0, y: 100 });
    const sideways  = token({ x: 500, y: 200 });
    expect(findThroughShotTarget(attacker, target, [sideways])).toBeNull();
  });
});
