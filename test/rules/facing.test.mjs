// test/rules/facing.test.mjs
//
// Facing / угол обзора (wdbc-p5el): пеленг, дуга, передняя арка Cloak.
// Соглашение — как у Foundry TokenDocument.rotation: 0° = на север (вверх),
// по часовой стрелке.

import { describe, it, expect } from "vitest";
import {
  normalizeAngle360, normalizeAngle180, bearingDegrees,
  relativeBearing, isWithinArc, isFrontArcHit,
  parseMountArc, isWithinMountArc, nearestPointBehindOnRay
} from "../../module/rules/facing.mjs";

describe("normalizeAngle360", () => {
  it("уже в диапазоне — не трогает", () => { expect(normalizeAngle360(90)).toBe(90); });
  it("отрицательный оборачивается", () => { expect(normalizeAngle360(-90)).toBe(270); });
  it("больше 360 оборачивается", () => { expect(normalizeAngle360(450)).toBe(90); });
});

describe("normalizeAngle180", () => {
  it("190 → -170 (короче через 0)", () => { expect(normalizeAngle180(190)).toBe(-170); });
  it("180 остаётся 180 (граница включена)", () => { expect(normalizeAngle180(180)).toBe(180); });
  it("-190 → 170", () => { expect(normalizeAngle180(-190)).toBe(170); });
});

describe("bearingDegrees — 0° на север, по часовой", () => {
  const O = { x: 0, y: 0 };
  it("точка выше (меньший Y) — 0° (север)", () => {
    expect(bearingDegrees(O, { x: 0, y: -10 })).toBe(0);
  });
  it("точка справа — 90° (восток)", () => {
    expect(bearingDegrees(O, { x: 10, y: 0 })).toBe(90);
  });
  it("точка ниже — 180° (юг)", () => {
    expect(bearingDegrees(O, { x: 0, y: 10 })).toBe(180);
  });
  it("точка слева — 270° (запад)", () => {
    expect(bearingDegrees(O, { x: -10, y: 0 })).toBe(270);
  });
  it("та же точка — 0°, не NaN/исключение", () => {
    expect(bearingDegrees(O, O)).toBe(0);
  });
});

describe("relativeBearing", () => {
  it("наблюдатель смотрит на север (0), цель на севере — 0 (прямо по курсу)", () => {
    expect(relativeBearing(0, 0)).toBe(0);
  });
  it("наблюдатель смотрит на восток (90), цель на севере — цель слева (-90)", () => {
    expect(relativeBearing(90, 0)).toBe(-90);
  });
  it("цель точно сзади — 180", () => {
    expect(relativeBearing(0, 180)).toBe(180);
  });
});

describe("isWithinArc", () => {
  it("прямо по курсу попадает в любую ненулевую дугу", () => {
    expect(isWithinArc(45, 45, 90)).toBe(true);
  });
  it("на границе арки 90° (±45°) — попадает", () => {
    expect(isWithinArc(0, 45, 90)).toBe(true);
    expect(isWithinArc(0, 315, 90)).toBe(true); // -45 через 0
  });
  it("чуть за границей арки 90° — не попадает", () => {
    expect(isWithinArc(0, 46, 90)).toBe(false);
  });
  it("сзади не попадает ни в какую разумную арку", () => {
    expect(isWithinArc(0, 180, 90)).toBe(false);
    expect(isWithinArc(0, 180, 210)).toBe(false);
  });
  it("базовый угол обзора персонажа 210° — почти всё видно, кроме узкого сектора сзади", () => {
    expect(isWithinArc(0, 100, 210)).toBe(true);
    expect(isWithinArc(0, 106, 210)).toBe(false);
  });
});

describe("isFrontArcHit — передняя арка 90° Плаща (Cloak)", () => {
  const defender = { x: 0, y: 0 };

  it("атакующий строго спереди (защитник смотрит на север, атакующий выше) — фронтальный хит", () => {
    expect(isFrontArcHit(defender, 0, { x: 0, y: -10 })).toBe(true);
  });

  it("атакующий строго сзади — не фронтальный хит, Плащ защищает", () => {
    expect(isFrontArcHit(defender, 0, { x: 0, y: 10 })).toBe(false);
  });

  it("атакующий сбоку (90° от курса) — вне арки 90° (граница ровно на краю не входит)", () => {
    expect(isFrontArcHit(defender, 0, { x: 10, y: 0 })).toBe(false);
  });

  it("разворот защитника меняет, что считается «спереди»", () => {
    // Защитник развернулся на восток (90°): атакующий с востока — теперь спереди.
    expect(isFrontArcHit(defender, 90, { x: 10, y: 0 })).toBe(true);
    // А тот же атакующий с севера — теперь сбоку, вне арки.
    expect(isFrontArcHit(defender, 90, { x: 0, y: -10 })).toBe(false);
  });

  it("нестандартная ширина арки — параметр, не захардкожен", () => {
    expect(isFrontArcHit(defender, 0, { x: 10, y: 0 }, 210)).toBe(true);
  });
});

describe("parseMountArc — vehicleMount.hArc/vArc (wdbc-m38e)", () => {
  it("360° и пустое/нераспознанное значение — не ограничено (null)", () => {
    expect(parseMountArc("360°")).toBeNull();
    expect(parseMountArc("")).toBeNull();
    expect(parseMountArc(undefined)).toBeNull();
    expect(parseMountArc("—")).toBeNull();
    expect(parseMountArc("рука")).toBeNull(); // пометка на рукопашном — не число
  });
  it("одиночное число — полная ширина по центру оси", () => {
    expect(parseMountArc("180°")).toEqual({ width: 180, center: 0 });
  });
  it("диапазон без переноса через 0 — центр и ширина как у обычного интервала", () => {
    expect(parseMountArc("−25°..+25°")).toEqual({ width: 50, center: 0 });
    expect(parseMountArc("−135°..−45°")).toEqual({ width: 90, center: -90 });
    expect(parseMountArc("+45°..+135°")).toEqual({ width: 90, center: 90 });
  });
  it("широкий спонсонный сектор (борт) — тоже просто интервал, без особого переноса", () => {
    expect(parseMountArc("−5°..−175°")).toEqual({ width: 170, center: -90 });
    expect(parseMountArc("+175°..+5°")).toEqual({ width: 170, center: 90 });
  });
});

describe("isWithinMountArc", () => {
  it("не ограничено (360°/—) — цель попадает при любом пеленге", () => {
    expect(isWithinMountArc(0, 179, "360°")).toBe(true);
    expect(isWithinMountArc(0, 179, "—")).toBe(true);
  });
  it("узкий корпусной сектор (±25°) — цель строго спереди попадает, сбоку нет", () => {
    expect(isWithinMountArc(0, 10, "−25°..+25°")).toBe(true);
    expect(isWithinMountArc(0, 90, "−25°..+25°")).toBe(false);
  });
  it("левый спонсон (центр −90°) — попадает цель слева, не попадает справа", () => {
    expect(isWithinMountArc(0, -90, "−135°..−45°")).toBe(true);
    expect(isWithinMountArc(0, 90, "−135°..−45°")).toBe(false);
  });
  it("разворот машины сдвигает сектор вместе с ней", () => {
    // Машина развернулась на восток (90) — «левый» спонсон (центр −90 от курса) теперь смотрит на север (0).
    expect(isWithinMountArc(90, 0, "−135°..−45°")).toBe(true);
  });
});

describe("nearestPointBehindOnRay (Выстрел Насквозь, wdbc-wlwf)", () => {
  const shooter = { x: 0, y: 0 };
  const target  = { x: 0, y: 100 }; // прямо «на юг» от стрелка

  it("кандидат строго на продолжении луча, дальше цели — находится", () => {
    const behind = { x: 0, y: 200, id: "behind" };
    expect(nearestPointBehindOnRay(shooter, target, [behind], 10)).toEqual(behind);
  });

  it("кандидат МЕЖДУ стрелком и целью — не считается «позади»", () => {
    const between = { x: 0, y: 50 };
    expect(nearestPointBehindOnRay(shooter, target, [between], 10)).toBeNull();
  });

  it("кандидат ровно на позиции цели — не дальше, не считается", () => {
    expect(nearestPointBehindOnRay(shooter, target, [{ x: 0, y: 100 }], 10)).toBeNull();
  });

  it("кандидат позади, но далеко в стороне от луча — вне коридора, не считается", () => {
    const wide = { x: 500, y: 200 };
    expect(nearestPointBehindOnRay(shooter, target, [wide], 10)).toBeNull();
  });

  it("кандидат позади и в пределах коридора вбок — считается", () => {
    const nearLine = { x: 5, y: 200 };
    expect(nearestPointBehindOnRay(shooter, target, [nearLine], 10)).toEqual(nearLine);
  });

  it("несколько кандидатов позади — берётся ближайший к цели (наименьшая проекция)", () => {
    const near = { x: 0, y: 150, id: "near" };
    const far  = { x: 0, y: 300, id: "far" };
    expect(nearestPointBehindOnRay(shooter, target, [far, near], 10)).toEqual(near);
  });

  it("стрелок и цель в одной точке — направления нет, null", () => {
    expect(nearestPointBehindOnRay(shooter, shooter, [{ x: 0, y: 200 }], 10)).toBeNull();
  });

  it("нет ни одного кандидата позади — null", () => {
    expect(nearestPointBehindOnRay(shooter, target, [], 10)).toBeNull();
  });
});
