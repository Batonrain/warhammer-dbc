// test/combat/minion-gm-control.test.mjs — перехват Миньона ГМом (wdbc-8x31x).
import { describe, it, expect } from "vitest";
import { seizedOwnership } from "../../module/combat/minion-gm-control.mjs";

describe("seizedOwnership", () => {
  it("игроки-владельцы становятся Наблюдателями, ГМ и низшие права не трогаются", () => {
    const isGM = id => id === "gm";
    expect(seizedOwnership({ default: 0, gm: 3, p1: 3, p2: 1 }, isGM))
      .toEqual({ default: 0, gm: 3, p1: 2, p2: 1 });
  });
  it("права по умолчанию «Владелец» тоже опускаются до Наблюдателя", () => {
    expect(seizedOwnership({ default: 3 })).toEqual({ default: 2 });
  });
});
