// Встречный тест лояльности демона-Проводника (wdbc-dq0r4).
import { describe, it, expect } from "vitest";
import { guideLoyaltyDefaultMode, resolveGuideLoyalty } from "../../module/rules/warp-guide.mjs";

describe("guideLoyaltyDefaultMode", () => {
  it("Миньон с Хозяином — тест Лояльности, иначе Inf против Inf", () => {
    expect(guideLoyaltyDefaultMode({ system: { masterUuid: "Actor.h", loyalty: { value: 40 } } })).toBe("loyalty");
    expect(guideLoyaltyDefaultMode({ system: {} })).toBe("inf");
  });
});

describe("resolveGuideLoyalty", () => {
  it("Лояльность: Успех демона — служит", () => {
    expect(resolveGuideLoyalty("loyalty", null, { value: 40, rv: 30 }).loyal).toBe(true);
    expect(resolveGuideLoyalty("loyalty", null, { value: 40, rv: 70 }).loyal).toBe(false);
  });
  it("Inf: больше Успехов у персонажей — служит, у демона — саботаж", () => {
    expect(resolveGuideLoyalty("inf", { value: 50, rv: 10 }, { value: 50, rv: 45 }).loyal).toBe(true);
    expect(resolveGuideLoyalty("inf", { value: 50, rv: 45 }, { value: 50, rv: 10 }).loyal).toBe(false);
  });
  it("ничья по степеням — выигрывает больший Порог", () => {
    expect(resolveGuideLoyalty("wp", { value: 45, rv: 40 }, { value: 41, rv: 40 }).loyal).toBe(true);
    expect(resolveGuideLoyalty("wp", { value: 41, rv: 40 }, { value: 45, rv: 40 }).loyal).toBe(false);
  });
});
