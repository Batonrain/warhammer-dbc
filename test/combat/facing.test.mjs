// test/combat/facing.test.mjs
//
// isFrontArcHit (wdbc-p5el) — обвязка чистой геометрии rules/facing.mjs под
// живой токен: центр из x/y/width/height (клетки, canvas.grid.size) + rotation.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { isFrontArcHit, isTargetWithinVehicleArc, tokenDistance, isOutsideDefenderView, applyDefaultSightAngle, DEFAULT_SIGHT_ANGLE_DEGREES } from "../../module/combat/facing.mjs";

/** Токен-заглушка: та же форма, что у tactical-map.test.mjs (document.x/y/width/height). */
function token({ x = 0, y = 0, width = 1, height = 1, rotation = 0, sight } = {}) {
  return { document: { x, y, width, height, rotation, ...(sight ? { sight } : {}) } };
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

describe("isTargetWithinVehicleArc (wdbc-m38e)", () => {
  it("корпусное орудие (узкий сектор) — цель спереди попадает, сбоку нет", () => {
    const vehicle = token({ x: 0, y: 0, rotation: 0 });
    const front = token({ x: 0, y: -300 });
    const side  = token({ x: 300, y: 0 });
    expect(isTargetWithinVehicleArc(vehicle, "−25°..+25°", front)).toBe(true);
    expect(isTargetWithinVehicleArc(vehicle, "−25°..+25°", side)).toBe(false);
  });

  it("башенное 360° — попадает при любом развороте машины", () => {
    const vehicle = token({ x: 0, y: 0, rotation: 45 });
    const rear = token({ x: 0, y: 300 });
    expect(isTargetWithinVehicleArc(vehicle, "360°", rear)).toBe(true);
  });

  it("нет позиции одного из токенов — безопасный дефолт true (не мешаем выстрелу)", () => {
    const vehicle = token({ x: 0, y: 0 });
    expect(isTargetWithinVehicleArc(vehicle, "−25°..+25°", null)).toBe(true);
    expect(isTargetWithinVehicleArc(null, "−25°..+25°", vehicle)).toBe(true);
  });
});

describe("isOutsideDefenderView (Скрытная Атака, wdbc-1rno.3)", () => {
  it("атакующий спереди, в дефолтном секторе 210° — не вне обзора", () => {
    const defender = token({ x: 0, y: 0, rotation: 0 });
    const attacker = token({ x: 0, y: -300 });
    expect(isOutsideDefenderView(defender, attacker)).toBe(false);
  });

  it("атакующий строго сзади — вне обзора даже с широким дефолтным 210°", () => {
    const defender = token({ x: 0, y: 0, rotation: 0 });
    const attacker = token({ x: 0, y: 300 });
    expect(isOutsideDefenderView(defender, attacker)).toBe(true);
  });

  it("в мёртвой зоне 150° (вне 210°-сектора, но не строго сзади) — вне обзора", () => {
    const defender = token({ x: 0, y: 0, rotation: 0 }); // смотрит на север, сектор −105°..+105°
    const attacker = token({ x: -300, y: 260 }); // пеленг ≈ −131° от курса — за пределами половины 105°
    expect(isOutsideDefenderView(defender, attacker)).toBe(true);
  });

  it("явно заданный узкий sight.angle защитника сужает сектор относительно дефолта", () => {
    const defender = token({ x: 0, y: 0, rotation: 0, sight: { angle: 90 } });
    const sideAttacker = token({ x: 260, y: -150 }); // ≈60° от курса — в 210°, но не в 90°
    expect(isOutsideDefenderView(defender, sideAttacker)).toBe(true);
  });

  it("sight.angle ≥360 — истинно круговой обзор, никогда не вне обзора", () => {
    const defender = token({ x: 0, y: 0, rotation: 0, sight: { angle: 360 } });
    const rearAttacker = token({ x: 0, y: 300 });
    expect(isOutsideDefenderView(defender, rearAttacker)).toBe(false);
  });

  it("нет позиции одного из токенов — безопасный дефолт false (не наказываем)", () => {
    const defender = token({ x: 0, y: 0 });
    expect(isOutsideDefenderView(defender, null)).toBe(false);
    expect(isOutsideDefenderView(null, defender)).toBe(false);
  });
});

describe("applyDefaultSightAngle (wdbc-1rno.3, preCreateActor)", () => {
  function fakeActor(existingAngle) {
    const calls = [];
    return {
      prototypeToken: { sight: { angle: existingAngle } },
      updateSource: (patch) => calls.push(patch),
      calls
    };
  }

  it("Foundry-дефолт 360 — переписывается на 210", () => {
    const actor = fakeActor(360);
    applyDefaultSightAngle(actor, {});
    expect(actor.calls).toEqual([{ "prototypeToken.sight.angle": DEFAULT_SIGHT_ANGLE_DEGREES }]);
  });

  it("незаданный угол (0/undefined) — тоже переписывается на 210", () => {
    const actor = fakeActor(0);
    applyDefaultSightAngle(actor, {});
    expect(actor.calls).toEqual([{ "prototypeToken.sight.angle": DEFAULT_SIGHT_ANGLE_DEGREES }]);
  });

  it("явно заданный нестандартный угол в data (payload создания) — не трогается", () => {
    const actor = fakeActor(360);
    applyDefaultSightAngle(actor, { prototypeToken: { sight: { angle: 90 } } });
    expect(actor.calls).toEqual([]);
  });

  it("уже настроенный на самом акторе угол, отличный от 360 — не трогается", () => {
    const actor = fakeActor(120);
    applyDefaultSightAngle(actor, {});
    expect(actor.calls).toEqual([]);
  });
});

describe("tokenDistance (wdbc-y33b, Пустотные Щиты)", () => {
  it("считает по grid.distance сцены, не жёстко «1 клетка = 1 метр»", () => {
    // Сцена: 1 клетка (100px) = 2 игровых метра.
    globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 2 } } };
    const a = token({ x: 0, y: 0 });
    const b = token({ x: 300, y: 0 }); // 3 клетки по прямой
    expect(tokenDistance(a, b)).toBe(6); // 3 клетки × 2 м/клетку
  });

  it("без scene.grid.distance откатывается к canvas.grid.distance, затем к 1", () => {
    globalThis.canvas = { grid: { size: 100, distance: 5 } };
    const a = token({ x: 0, y: 0 });
    const b = token({ x: 200, y: 0 });
    expect(tokenDistance(a, b)).toBe(10); // 2 клетки × 5

    globalThis.canvas = { grid: { size: 100 } };
    expect(tokenDistance(a, b)).toBe(2); // 2 клетки × 1 (дефолт)
  });

  it("учитывает центр по width/height (2×2 токен), не левый верхний угол", () => {
    globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } };
    const a = token({ x: 0, y: 0, width: 2, height: 2 }); // центр (100,100)
    const b = token({ x: 100, y: 100, width: 1, height: 1 }); // центр (150,150)
    expect(tokenDistance(a, b)).toBeCloseTo(Math.hypot(50, 50) / 100, 5);
  });

  it("нет позиции одного из токенов — null", () => {
    globalThis.canvas = { grid: { size: 100 } };
    expect(tokenDistance(token({ x: 0, y: 0 }), null)).toBeNull();
  });
});
