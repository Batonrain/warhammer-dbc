// test/rules/soul-seer.test.mjs
import { describe, it, expect } from "vitest";
import { soulSeerCategory, SOUL_SEER_RADIUS_M } from "../../module/rules/soul-seer.mjs";

describe("soulSeerCategory", () => {
  it("character — человек", () => expect(soulSeerCategory("character")).toBe("человек"));
  it("vehicle — дух машины", () => expect(soulSeerCategory("vehicle")).toBe("дух машины"));
  it("daemon/demonPrince — демон", () => {
    expect(soulSeerCategory("daemon")).toBe("демон");
    expect(soulSeerCategory("demonPrince")).toBe("демон");
  });
  it("прочие типы (horde/squad/ship/minion) — вне книжных трёх категорий", () => {
    expect(soulSeerCategory("horde")).toBe("");
    expect(soulSeerCategory("squad")).toBe("");
    expect(soulSeerCategory("ship")).toBe("");
  });
});

it("радиус — 10м из текста, не зависит от персонажа", () => {
  expect(SOUL_SEER_RADIUS_M).toBe(10);
});
