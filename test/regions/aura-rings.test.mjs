// test/regions/aura-rings.test.mjs
//
// Круг ауры на канвасе (wdbc-7t0z) — только чистая логика цвета. Сама
// отрисовка (redrawAuraRings) канвас-зависима и здесь не тестируется, по
// тому же прецеденту, что sweepAurasOnScene в test/regions/auras.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { auraRingColor } from "../../module/regions/aura-rings.mjs";

describe("auraRingColor", () => {
  it("enemies — угрожающий/демонический цвет", () => {
    expect(auraRingColor("enemies")).toBe(0xaa2255);
  });
  it("allies — дружелюбный цвет", () => {
    expect(auraRingColor("allies")).toBe(0x4ec9ff);
  });
  it("all — нейтральный цвет", () => {
    expect(auraRingColor("all")).toBe(0xe0c34c);
  });
  it("неизвестное значение — как allies (дефолт)", () => {
    expect(auraRingColor(undefined)).toBe(0x4ec9ff);
  });
});
