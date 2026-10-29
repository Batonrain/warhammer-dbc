// test/regions/aura-rings.test.mjs
//
// Круг ауры на канвасе (wdbc-7t0z) — только чистая логика цвета. Сама
// отрисовка (redrawAuraRings) канвас-зависима и здесь не тестируется, по
// тому же прецеденту, что sweepAurasOnScene в test/regions/auras.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { auraRingColor } from "../../module/regions/aura-rings.mjs";

describe("auraRingColor", () => {
  it("враги, союзники и «все» различимы по цвету круга", () => {
    const colors = ["enemies", "allies", "all"].map(auraRingColor);
    expect(new Set(colors).size).toBe(3);
  });
  it("неизвестное значение — как allies (дефолт)", () => {
    expect(auraRingColor(undefined)).toBe(auraRingColor("allies"));
  });
});
