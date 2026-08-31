// test/combat/through-shot.test.mjs
//
// Выстрел Насквозь (стр. 74 Книги Аэльдари): пробивает укрытие/цель, если
// AP+T.b < Pen×2, урон следующей цели снижается по цепочке −1d10 → −1d5 → −1.

import { describe, it, expect } from "vitest";
import { throughShotPierces, throughShotReductionDie } from "../../module/combat/through-shot.mjs";

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
