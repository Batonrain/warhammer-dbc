// test/combat/arc.test.mjs
//
// Свойство Дуга (Arc, wdbc-wlwf): «ближайший другой токен в 5м» — обвязка
// tokenDistance (module/combat/facing.mjs) под живые токены. Та же
// токен-заглушка, что и в facing.test.mjs (document.x/y/width/height).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { findArcTarget } from "../../module/combat/arc.mjs";
import { aggregateAuto, resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";

function token({ x = 0, y = 0, width = 1, height = 1, id = "" } = {}) {
  return { id, actor: {}, document: { x, y, width, height, rotation: 0 } };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } };
});

describe("findArcTarget", () => {
  it("выбирает ближайшего другого токена в радиусе", () => {
    const origin = token({ x: 0, y: 0, id: "origin" });
    const near   = token({ x: 200, y: 0, id: "near" });  // 2м
    const far    = token({ x: 400, y: 0, id: "far" });   // 4м
    expect(findArcTarget(origin, [origin, near, far], 5)).toBe(near);
  });

  it("не выбирает сам originToken", () => {
    const origin = token({ x: 0, y: 0, id: "origin" });
    expect(findArcTarget(origin, [origin], 5)).toBeNull();
  });

  it("токены вне радиуса игнорируются", () => {
    const origin = token({ x: 0, y: 0, id: "origin" });
    const outOfRange = token({ x: 600, y: 0, id: "far" }); // 6м > 5м
    expect(findArcTarget(origin, [origin, outOfRange], 5)).toBeNull();
  });

  it("кандидаты без актора (нет токена персонажа) пропускаются", () => {
    const origin = token({ x: 0, y: 0, id: "origin" });
    const empty  = { id: "empty", actor: null, document: { x: 100, y: 0, width: 1, height: 1 } };
    expect(findArcTarget(origin, [origin, empty], 5)).toBeNull();
  });

  it("нет originToken — null", () => {
    expect(findArcTarget(null, [token()], 5)).toBeNull();
  });
});

describe("aggregateAuto — Дуга (Arc) с дайс-рейтингом rating2 (wdbc-wv8u)", () => {
  it("голое число rating2 работает как раньше (Math.max)", () => {
    const props = resolveWeaponPropsList([{ key: "arc", rating: 7, rating2: 12 }]);
    const wp = aggregateAuto(props);
    expect(wp.arcRating).toBe(7);
    expect(wp.arcDamage).toBe(12);
  });

  it("дайс-строка в rating2 сохраняется КАК ЕСТЬ, не даёт NaN (раньше Math.max(0,\"2d10\") тихо портил wp.arcDamage целиком)", () => {
    const props = resolveWeaponPropsList([{ key: "arc", rating: 7, rating2: "2d10+PR" }]);
    const wp = aggregateAuto(props);
    expect(wp.arcDamage).toBe("2d10+PR");
    expect(Number.isNaN(wp.arcDamage)).toBe(false);
  });

  it("без свойства Дуга — arcDamage остаётся дефолтным нулём", () => {
    const wp = aggregateAuto(resolveWeaponPropsList([]));
    expect(wp.arcDamage).toBe(0);
  });
});
