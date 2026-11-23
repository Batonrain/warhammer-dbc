// Лорд Дискордант: Вор Духов, Адосвязанный, аура (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { stolenSpirits, hellboundMark, hellboundLimit, noosphereAuraOn, isTechPriest, spiritThiefRange } from "../../module/rules/lord-discordant.mjs";

describe("Вор Духов Машины", () => {
  it("духи = max(Размер, ⌊I.b/3⌋)", () => {
    expect(stolenSpirits({ size: 4, intB: 3 })).toBe(4);
    expect(stolenSpirits({ size: 1, intB: 7 })).toBe(2);
    expect(stolenSpirits({ size: -1, intB: 2 })).toBe(0);
  });
  it("радиус эффектов — I×0,5 м", () => {
    expect(spiritThiefRange({ system: { characteristics: { int: { total: 45 } } } })).toBe(22);
  });
});

describe("Адосвязанный", () => {
  it("предел ½W.b (окр.▲), лишняя вытесняет самую старую", () => {
    expect(hellboundLimit({ system: { characteristics: { wp: { bonus: 5 } } } })).toBe(3);
    let r = hellboundMark([], { uuid: "a", name: "A" }, 2);
    r = hellboundMark(r.list, { uuid: "b", name: "B" }, 2);
    expect(r.dropped).toBe(null);
    r = hellboundMark(r.list, { uuid: "c", name: "C" }, 2);
    expect(r.dropped.uuid).toBe("a");
    expect(r.list.map(m => m.uuid)).toEqual(["b", "c"]);
    expect(hellboundMark(r.list, { uuid: "c" }, 2).dropped).toBe(null);
  });
});

describe("Порченная Ноосфера", () => {
  it("аура только верхом, техножрец — у кого есть Техночудеса", () => {
    const trait = { type: "trait", name: "Corrupted Noosphere / Порченная Ноосфера" };
    expect(noosphereAuraOn({ items: [trait], system: { mount: { uuid: "Actor.x" } } })).toBe(true);
    expect(noosphereAuraOn({ items: [trait], system: { mount: { uuid: "" } } })).toBe(false);
    expect(isTechPriest({ items: [{ type: "techPower" }] })).toBe(true);
    expect(isTechPriest({ items: [] })).toBe(false);
  });
});
