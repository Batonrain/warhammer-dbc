// test/combat/range-band.test.mjs
//
// Полосы дальности (wdbc-mysg): диалог атаки уже меряет дистанцию до цели —
// галочку полосы он теперь ставит сам, по таблице стр. 40 корбука
// («+30 в упор 0,5–3 м · +10 до Rng/2 · +0 до Rng · −10 до Rng×2 ·
//  −30 до Rng×3»), дальше выстрел невозможен. Плюс «Положение выше» по
// elevation токенов.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { rangeBandKey, RANGE_BANDS, rangeBandBoundaries } from "../../module/rules/tactical-map.mjs";
import { hasHighGround } from "../../module/combat/tactical-map.mjs";

describe("rangeBandKey: метры + Rng → полоса", () => {
  it("до 3 м включительно — в упор, независимо от Rng", () => {
    expect(rangeBandKey(0, 30)).toBe("pointBlank");
    expect(rangeBandKey(3, 30)).toBe("pointBlank");
    expect(rangeBandKey(3, 4)).toBe("pointBlank");
  });

  it("от 3 м до половины Rng — короткая", () => {
    expect(rangeBandKey(4, 30)).toBe("short");
    expect(rangeBandKey(15, 30)).toBe("short");
  });

  it("от половины Rng до Rng — боевая", () => {
    expect(rangeBandKey(16, 30)).toBe("combat");
    expect(rangeBandKey(30, 30)).toBe("combat");
  });

  it("до двух Rng — дальняя, до трёх — экстремальная", () => {
    expect(rangeBandKey(31, 30)).toBe("long");
    expect(rangeBandKey(60, 30)).toBe("long");
    expect(rangeBandKey(61, 30)).toBe("extreme");
    expect(rangeBandKey(90, 30)).toBe("extreme");
  });

  it("дальше 3×Rng — цель вне дальности", () => {
    expect(rangeBandKey(91, 30)).toBe("out");
  });

  it("вырожденная короткая полоса (Rng 4): в упор сразу переходит в боевую", () => {
    expect(rangeBandKey(3, 4)).toBe("pointBlank");
    expect(rangeBandKey(4, 4)).toBe("combat");
  });

  it("без Rng или без дистанции считать нечего", () => {
    expect(rangeBandKey(10, 0)).toBe(null);
    expect(rangeBandKey(NaN, 30)).toBe(null);
    expect(rangeBandKey(undefined, 30)).toBe(null);
  });

  it("каждая полоса таблицы достижима и несёт модификатор книги", () => {
    const mods = Object.fromEntries(RANGE_BANDS.map(b => [b.key, b.mod]));
    expect(mods).toEqual({ pointBlank: 30, short: 10, combat: 0, long: -10, extreme: -30 });
    for (const b of RANGE_BANDS) expect(RANGE_BANDS.filter(x => x.key === b.key)).toHaveLength(1);
  });
});

describe("rangeBandBoundaries: границы полос в метрах (общая точка правды подсказки диалога и колец дальности wdbc-fb2d)", () => {
  it("Rng 30 — стандартные границы", () => {
    expect(rangeBandBoundaries(30)).toEqual({ pointBlank: 3, short: 15, combat: 30, long: 60, extreme: 90 });
  });

  it("нечётный Rng — граница короткой полосы округляется вверх (для подсказки/колец), сам rangeBandKey делит по точной половине", () => {
    const b = rangeBandBoundaries(15);
    expect(b.short).toBe(8);
    expect(rangeBandKey(7, 15)).toBe("short");
    expect(rangeBandKey(8, 15)).toBe("combat");
  });

  it("Rng 0 или отсутствующий — все границы схлопываются в 0, кроме упора", () => {
    expect(rangeBandBoundaries(0)).toEqual({ pointBlank: 3, short: 0, combat: 0, long: 0, extreme: 0 });
    expect(rangeBandBoundaries(undefined)).toEqual({ pointBlank: 3, short: 0, combat: 0, long: 0, extreme: 0 });
  });
});

describe("hasHighGround: «Положение выше» по elevation", () => {
  const tok = elevation => ({ document: { elevation } });

  it("атакующий выше цели", () => {
    expect(hasHighGround(tok(3), tok(0))).toBe(true);
  });

  it("вровень или ниже — не выше", () => {
    expect(hasHighGround(tok(0), tok(0))).toBe(false);
    expect(hasHighGround(tok(0), tok(3))).toBe(false);
  });

  it("отсутствующая elevation считается нулём", () => {
    expect(hasHighGround(tok(undefined), tok(-2))).toBe(true);
  });

  it("принимает и голый TokenDocument", () => {
    expect(hasHighGround({ elevation: 5 }, { elevation: 1 })).toBe(true);
  });

  it("нет одного из токенов — null (отметят руками)", () => {
    expect(hasHighGround(null, tok(0))).toBe(null);
    expect(hasHighGround(tok(0), null)).toBe(null);
  });
});
