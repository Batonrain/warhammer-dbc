// test/rules/improvised-weapon.test.mjs
//
// Импровизированное оружие / Метание (стр. 27-28) — чистая классификация по
// весу/размеру, без Foundry. module/combat/grapple.mjs — единственный
// сегодняшний потребитель (партнёр по Захвату как снаряд/дубина), сами
// функции завязаны только на actor.system.

import { describe, it, expect } from "vitest";
import { bodyWeightOf, totalWeightOf, throwTier, canWieldAsCudgel, footingRequirement }
  from "../../module/rules/improvised-weapon.mjs";

function actorFor({ weight = 0, current = 0, carry = 0, size = 0 } = {}) {
  return { system: { bio: { weight }, encumbrance: { current, carry }, size, sizeMod: 0 } };
}

describe("bodyWeightOf / totalWeightOf", () => {
  it("bodyWeightOf — только тело, без снаряжения", () => {
    expect(bodyWeightOf(actorFor({ weight: 80, current: 15 }))).toBe(80);
  });

  it("totalWeightOf — тело + снаряжение (Ношение)", () => {
    expect(totalWeightOf(actorFor({ weight: 80, current: 15 }))).toBe(95);
  });

  it("нет данных — 0, не падает", () => {
    expect(bodyWeightOf({})).toBe(0);
    expect(totalWeightOf({})).toBe(0);
    expect(bodyWeightOf(null)).toBe(0);
  });
});

describe("throwTier", () => {
  it("лёгкий — до ¼ Ношения включительно: BS+0", () => {
    expect(throwTier(100, 25)).toBe("light");
    expect(throwTier(100, 10)).toBe("light");
  });

  it("средний — от ¼ до ½ Ношения: Athletics(S)+0", () => {
    expect(throwTier(100, 26)).toBe("medium");
    expect(throwTier(100, 50)).toBe("medium");
  });

  it("тяжёлый — от ½ до полного Ношения: Athletics(S)−30", () => {
    expect(throwTier(100, 51)).toBe("heavy");
    expect(throwTier(100, 100)).toBe("heavy");
  });

  it("тяжелее полного Ношения — метать нельзя вовсе (null)", () => {
    expect(throwTier(100, 101)).toBeNull();
  });

  it("нулевое/отсутствующее Ношение — null, не Infinity/NaN-тир", () => {
    expect(throwTier(0, 1)).toBeNull();
    expect(throwTier(undefined, 1)).toBeNull();
  });
});

describe("canWieldAsCudgel", () => {
  it("легче ¼ Ношения и Размер не больше — годится", () => {
    const wielder = actorFor({ carry: 100, size: 0 });
    const payload = actorFor({ weight: 20, size: 0 });
    expect(canWieldAsCudgel(wielder, payload)).toBe(true);
  });

  it("тяжелее ¼ Ношения — не годится, даже с тем же Размером", () => {
    const wielder = actorFor({ carry: 100, size: 0 });
    const payload = actorFor({ weight: 26, size: 0 });
    expect(canWieldAsCudgel(wielder, payload)).toBe(false);
  });

  it("Размер payload'а больше владельца — не годится, даже если лёгкий", () => {
    const wielder = actorFor({ carry: 100, size: 0 });
    const payload = actorFor({ weight: 10, size: 1 });
    expect(canWieldAsCudgel(wielder, payload)).toBe(false);
  });

  it("Размер payload'а равен владельцу — годится", () => {
    const wielder = actorFor({ carry: 100, size: 1 });
    const payload = actorFor({ weight: 10, size: 1 });
    expect(canWieldAsCudgel(wielder, payload)).toBe(true);
  });

  it("у владельца нет Ношения (0) — не годится", () => {
    const wielder = actorFor({ carry: 0, size: 0 });
    const payload = actorFor({ weight: 1, size: 0 });
    expect(canWieldAsCudgel(wielder, payload)).toBe(false);
  });
});

describe("footingRequirement", () => {
  it("снаряд легче 0.5× тела бросающего — опора не важна", () => {
    expect(footingRequirement(80, 30)).toBe("none");
  });

  it("0.5-1.5× тела — нужна опора либо совмещённый тест", () => {
    expect(footingRequirement(80, 40)).toBe("check");
    expect(footingRequirement(80, 119)).toBe("check");
  });

  it("1.5-3× тела — без опоры нельзя, с опорой тест как без неё", () => {
    expect(footingRequirement(80, 120)).toBe("harsh");
    expect(footingRequirement(80, 239)).toBe("harsh");
  });

  it("3× тела и больше — только магия", () => {
    expect(footingRequirement(80, 240)).toBe("impossible");
  });

  it("вес тела бросающего не заполнен — не блокируем бросок (none)", () => {
    expect(footingRequirement(0, 500)).toBe("none");
  });
});
