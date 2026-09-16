// test/rules/fruit-of-flesh.test.mjs
import { describe, it, expect } from "vitest";
import { fruitKindByLabel, fruitHealWounds, fruitHealAmount, fruitMaturityRemaining,
         fruitFlameRating, fruitRadRating, fruitBlastRating } from "../../module/rules/fruit-of-flesh.mjs";

describe("fruitKindByLabel", () => {
  it("распознаёт все 12 подписей субмутаций", () => {
    expect(fruitKindByLabel("0")).toBe("heal");
    expect(fruitKindByLabel("1")).toBe("haywire");
    expect(fruitKindByLabel("2-3")).toBe("smoke");
    expect(fruitKindByLabel("4-5")).toBe("flame");
    expect(fruitKindByLabel("6")).toBe("stun");
    expect(fruitKindByLabel("7")).toBe("toxicRad");
    expect(fruitKindByLabel("8")).toBe("psychicDamage");
    expect(fruitKindByLabel("9")).toBe("psychicLock");
    expect(fruitKindByLabel("10")).toBe("shard");
    expect(fruitKindByLabel("11")).toBe("triple");
  });
  it("пустая/нераспознанная подпись — пустая строка", () => {
    expect(fruitKindByLabel("")).toBe("");
    expect(fruitKindByLabel(undefined)).toBe("");
    expect(fruitKindByLabel("12")).toBe("");
  });
});

describe("fruitHealWounds", () => {
  it("прибавляет лечение, клэмп к максимуму", () => {
    expect(fruitHealWounds({ wounds: { value: 5, max: 12 } }, 10)).toBe(12);
    expect(fruitHealWounds({ wounds: { value: 5, max: 12 } }, 3)).toBe(8);
  });
  it("отрицательное/NaN лечение не уменьшает Раны", () => {
    expect(fruitHealWounds({ wounds: { value: 5, max: 12 } }, -3)).toBe(5);
  });
});

describe("fruitHealAmount", () => {
  it("не больше вместимости плода", () => {
    expect(fruitHealAmount(15, 8)).toBe(8);
    expect(fruitHealAmount(4, 8)).toBe(4);
  });
});

describe("fruitMaturityRemaining", () => {
  it("0, если срок (абсолютный worldTime) уже прошёл; иначе — остаток", () => {
    expect(fruitMaturityRemaining(300, 500)).toBe(0);
    expect(fruitMaturityRemaining(350, 150)).toBe(200);
  });
});

describe("fruitFlameRating", () => {
  it("максимум магнитуд, минимум 1 на каждую запись", () => {
    expect(fruitFlameRating([3, 7, 2])).toBe(7);
    expect(fruitFlameRating([0, 0])).toBe(1);
  });
  it("без потушенных — 0", () => {
    expect(fruitFlameRating([])).toBe(0);
  });
});

describe("fruitRadRating", () => {
  it("десятки суммарной дозы, минимум 1 при ненулевой дозе", () => {
    expect(fruitRadRating(35)).toBe(3);
    expect(fruitRadRating(5)).toBe(1);
    expect(fruitRadRating(0)).toBe(0);
  });
});

describe("fruitBlastRating", () => {
  it("половина Cor.b, округление вверх", () => {
    expect(fruitBlastRating(5)).toBe(3);
    expect(fruitBlastRating(4)).toBe(2);
    expect(fruitBlastRating(0)).toBe(0);
  });
});
