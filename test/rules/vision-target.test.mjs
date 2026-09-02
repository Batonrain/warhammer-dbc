// test/rules/vision-target.test.mjs
//
// module/rules/vision-target.mjs (wdbc-1rno, «Икона Богохульства») —
// геометрическая проверка «наблюдатель видит цель по дальности+сектору»,
// без стен. См. шапку модуля: конвенция rotation НЕ проверена на живом
// Foundry-канвасе, только выведена из документированного поведения ядра.

// vision-target.mjs re-uses tokenDocDistance из regions/auras.mjs, а тот
// транзитивно тянет apps/mechanics.mjs → regions/difficult-terrain.mjs,
// которому нужен global `foundry` уже на этапе загрузки модуля (extends
// foundry.data.regionBehaviors...) — заглушка нужна до самого импорта.
import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { isTokenInSight, tokensThatCanSee, sightRangeOf } from "../../module/rules/vision-target.mjs";

const grid = { size: 100, distance: 2 }; // 1 клетка = 100px = 2м

/** Токен в клетках сетки (не пикселях) для читаемости тестов. */
function token(id, { gx = 0, gy = 0, rotation = 0, range = 10, angle = 0, w = 1, h = 1 } = {}) {
  return { id, x: gx * grid.size, y: gy * grid.size, width: w, height: h, rotation, sight: { range, angle } };
}

describe("sightRangeOf", () => {
  it("sight.range > 0 — используется как есть", () => {
    expect(sightRangeOf({ sight: { range: 15 } })).toBe(15);
  });

  it("sight.range 0/не задано — запасное значение 30", () => {
    expect(sightRangeOf({ sight: { range: 0 } })).toBe(30);
    expect(sightRangeOf({})).toBe(30);
  });
});

describe("isTokenInSight: только дальность (angle=0 — круговой обзор)", () => {
  it("цель в пределах дальности — видна", () => {
    const observer = token("o", { range: 10 });
    const target = token("t", { gx: 4 }); // 4 клетки × 2м = 8м
    expect(isTokenInSight(observer, target, grid)).toBe(true);
  });

  it("цель за пределами дальности — не видна", () => {
    const observer = token("o", { range: 5 });
    const target = token("t", { gx: 4 }); // 8м > 5м
    expect(isTokenInSight(observer, target, grid)).toBe(false);
  });

  it("дальность 0 — используется запасное значение, не «слеп»", () => {
    const observer = token("o", { range: 0 });
    const target = token("t", { gx: 4 }); // 8м < запасных 30м
    expect(isTokenInSight(observer, target, grid)).toBe(true);
  });

  it("та же клетка — видна (дистанция 0)", () => {
    const observer = token("o", { range: 5 });
    const target = token("t", { gx: 0, gy: 0 });
    expect(isTokenInSight(observer, target, grid)).toBe(true);
  });
});

describe("isTokenInSight: сектор обзора (angle сужает)", () => {
  // rotation=0 => facing «вверх» (север, gy уменьшается).
  it("цель прямо по направлению взгляда (rotation=0, цель выше) — видна в узком секторе", () => {
    const observer = token("o", { range: 10, angle: 60, rotation: 0 });
    const target = token("t", { gx: 0, gy: -4 }); // выше наблюдателя
    expect(isTokenInSight(observer, target, grid)).toBe(true);
  });

  it("цель точно сзади (rotation=0, цель ниже) — вне узкого сектора", () => {
    const observer = token("o", { range: 10, angle: 60, rotation: 0 });
    const target = token("t", { gx: 0, gy: 4 }); // ниже — позади при взгляде вверх
    expect(isTokenInSight(observer, target, grid)).toBe(false);
  });

  it("цель сзади, но angle=360 (круговой обзор) — всё равно видна", () => {
    const observer = token("o", { range: 10, angle: 360, rotation: 0 });
    const target = token("t", { gx: 0, gy: 4 });
    expect(isTokenInSight(observer, target, grid)).toBe(true);
  });

  it("поворот наблюдателя на 90° (facing вправо) — цель справа теперь видна", () => {
    const observer = token("o", { range: 10, angle: 60, rotation: 90 });
    const target = token("t", { gx: 4, gy: 0 }); // справа от наблюдателя
    expect(isTokenInSight(observer, target, grid)).toBe(true);
  });

  it("узкий сектор (30°), цель на границе половины угла — не видна за пределом", () => {
    const observer = token("o", { range: 10, angle: 10, rotation: 0 });
    // Цель почти сбоку (45° от направления взгляда) — точно вне 10°-сектора.
    const target = token("t", { gx: 4, gy: -4 });
    expect(isTokenInSight(observer, target, grid)).toBe(false);
  });
});

describe("tokensThatCanSee", () => {
  it("отбирает только тех, кому видна цель, исключая саму цель", () => {
    const target = token("target", { gx: 0, gy: 0 });
    const seer = token("seer", { gx: 2, gy: 0, range: 10, angle: 0 });
    const blind = token("blind", { gx: 2, gy: 0, range: 1, angle: 0 });
    const candidates = [target, seer, blind];
    const result = tokensThatCanSee(target, candidates, grid);
    expect(result.map(t => t.id)).toEqual(["seer"]);
  });

  it("пустой список кандидатов — пустой результат", () => {
    const target = token("target");
    expect(tokensThatCanSee(target, [], grid)).toEqual([]);
  });
});
