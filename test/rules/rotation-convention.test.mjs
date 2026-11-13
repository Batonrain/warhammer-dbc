// test/rules/rotation-convention.test.mjs
//
// Конвенция TokenDocument.rotation в Foundry v14: 0 — токен смотрит ВНИЗ
// экрана (юг), значение растёт по часовой: 90 — запад, 180 — север, 270 —
// восток. Источник: client/canvas/placeables/token.mjs (автоповорот при
// движении: rotation = toDegrees(ray.angle) − 90) и
// client/canvas/geometry/shapes/limited-angle-polygon.mjs
// (aMin = rotation + 90 − angle/2). Замер на живом канвасе: Sahara 180-rotation-0.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { facingBearing, isFrontArcHit, isWithinMountArc, bearingDegrees } from "../../module/rules/facing.mjs";
import { isTokenInSight } from "../../module/rules/vision-target.mjs";

const grid = { size: 100, distance: 2 };

const SIDES = {
  north: { dx: 0, dy: -4, bearing: 0 },
  east: { dx: 4, dy: 0, bearing: 90 },
  south: { dx: 0, dy: 4, bearing: 180 },
  west: { dx: -4, dy: 0, bearing: 270 }
};

const ROTATION_FACING = { 0: "south", 90: "west", 180: "north", 270: "east" };

const tok = (id, gx, gy, rotation, angle = 60) =>
  ({ id, x: gx * grid.size, y: gy * grid.size, width: 1, height: 1, rotation, sight: { range: 30, angle } });

describe("facingBearing — пеленг взгляда токена по его rotation", () => {
  it("0 → юг (180), 90 → запад (270), 180 → север (0), 270 → восток (90)", () => {
    expect(facingBearing(0)).toBe(180);
    expect(facingBearing(90)).toBe(270);
    expect(facingBearing(180)).toBe(0);
    expect(facingBearing(270)).toBe(90);
  });

  it("нечисловое значение — как 0 (юг)", () => {
    expect(facingBearing(undefined)).toBe(180);
  });
});

describe("isTokenInSight: сектор 60° по четырём сторонам света", () => {
  for (const [rotation, facing] of Object.entries(ROTATION_FACING)) {
    for (const [side, s] of Object.entries(SIDES)) {
      const expected = side === facing;
      it(`rotation ${rotation} (смотрит на ${facing}): цель на ${side} — ${expected ? "видна" : "не видна"}`, () => {
        const observer = tok("o", 10, 10, Number(rotation));
        const target = tok("t", 10 + s.dx, 10 + s.dy, 0);
        expect(isTokenInSight(observer, target, grid)).toBe(expected);
      });
    }
  }
});

describe("isFrontArcHit: передняя арка 90° по четырём сторонам света", () => {
  const defender = { x: 0, y: 0 };
  for (const [rotation, facing] of Object.entries(ROTATION_FACING)) {
    for (const [side, s] of Object.entries(SIDES)) {
      const expected = side === facing;
      it(`rotation ${rotation} (смотрит на ${facing}): атакующий на ${side} — ${expected ? "спереди" : "не спереди"}`, () => {
        expect(isFrontArcHit(defender, Number(rotation), { x: s.dx * 10, y: s.dy * 10 })).toBe(expected);
      });
    }
  }
});

describe("isWithinMountArc: сектор наводки ±25° от продольной оси машины", () => {
  for (const [rotation, facing] of Object.entries(ROTATION_FACING)) {
    for (const [side, s] of Object.entries(SIDES)) {
      const expected = side === facing;
      it(`rotation ${rotation} (нос на ${facing}): цель на ${side} — ${expected ? "в секторе" : "вне сектора"}`, () => {
        expect(isWithinMountArc(Number(rotation), s.bearing, "−25°..+25°")).toBe(expected);
      });
    }
  }

  it("правый борт (+90°) машины с носом на юг (rotation 0) — это запад", () => {
    expect(isWithinMountArc(0, bearingDegrees({ x: 0, y: 0 }, { x: -10, y: 0 }), "+45°..+135°")).toBe(true);
    expect(isWithinMountArc(0, bearingDegrees({ x: 0, y: 0 }, { x: 10, y: 0 }), "+45°..+135°")).toBe(false);
  });
});
