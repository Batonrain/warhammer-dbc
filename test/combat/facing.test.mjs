// test/combat/facing.test.mjs
//
// isFrontArcHit (wdbc-p5el) — обвязка чистой геометрии rules/facing.mjs под
// живой токен: центр из x/y/width/height (клетки, canvas.grid.size) + rotation.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { isFrontArcHit } from "../../module/combat/facing.mjs";

/** Токен-заглушка: та же форма, что у tactical-map.test.mjs (document.x/y/width/height). */
function token({ x = 0, y = 0, width = 1, height = 1, rotation = 0 } = {}) {
  return { document: { x, y, width, height, rotation } };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 100 } };
});

describe("isFrontArcHit", () => {
  it("атакующий спереди (защитник смотрит на север, атакующий выше) — фронтальный хит", () => {
    const defender = token({ x: 0, y: 0, rotation: 0 });
    const attacker = token({ x: 0, y: -300, rotation: 0 });
    expect(isFrontArcHit(defender, attacker)).toBe(true);
  });

  it("атакующий сзади — не фронтальный хит", () => {
    const defender = token({ x: 0, y: 0, rotation: 0 });
    const attacker = token({ x: 0, y: 300, rotation: 0 });
    expect(isFrontArcHit(defender, attacker)).toBe(false);
  });

  it("центр считается по width/height, не по левому верхнему углу (2×2 токен)", () => {
    // Защитник 2×2 клетки в (0,0) → центр (100,100). Атакующий прямо к северу от ЦЕНТРА.
    const defender = token({ x: 0, y: 0, width: 2, height: 2, rotation: 0 });
    const attacker = token({ x: 50, y: -300, width: 1, height: 1, rotation: 0 });
    expect(isFrontArcHit(defender, attacker)).toBe(true);
  });

  it("разворот защитника меняет переднюю дугу", () => {
    const defender = token({ x: 0, y: 0, rotation: 90 }); // смотрит на восток
    const eastAttacker = token({ x: 300, y: 0 });
    const northAttacker = token({ x: 0, y: -300 });
    expect(isFrontArcHit(defender, eastAttacker)).toBe(true);
    expect(isFrontArcHit(defender, northAttacker)).toBe(false);
  });

  it("нет позиции у одного из токенов — безопасный дефолт false (Плащ защищает)", () => {
    const defender = token({ x: 0, y: 0 });
    expect(isFrontArcHit(defender, null)).toBe(false);
    expect(isFrontArcHit(null, defender)).toBe(false);
  });

  it("нестандартная ширина арки — параметр", () => {
    const defender = token({ x: 0, y: 0, rotation: 0 });
    const sideAttacker = token({ x: 300, y: 0 }); // строго сбоку (90° от курса)
    expect(isFrontArcHit(defender, sideAttacker, 90)).toBe(false);
    expect(isFrontArcHit(defender, sideAttacker, 210)).toBe(true);
  });
});
