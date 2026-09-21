// test/rules/squeeze.test.mjs
//
// Стены и Двери (wdbc-x1nz.2, стр. 31): «двигаться через проходы шириной
// до половины его Базы... без замедления», уже — теснота. Чистая геометрия,
// без canvas — Foundry-обвязка в test/combat/squeeze.test.mjs.

import { describe, it, expect } from "vitest";
import { segmentsIntersect, narrowestDoorCrossed, isSqueeze } from "../../module/rules/squeeze.mjs";

describe("segmentsIntersect", () => {
  it("отрезки пересекаются крест-накрест", () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
  });

  it("параллельные отрезки не пересекаются", () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
  });

  it("отрезки далеко друг от друга не пересекаются", () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 100, y: 100 }, { x: 101, y: 101 })).toBe(false);
  });
});

describe("narrowestDoorCrossed", () => {
  const cellPx = 100; // 1 клетка = 100px

  it("движение по прямой через дверь-перегородку (перпендикулярно) — засчитано", () => {
    // Дверь — вертикальный сегмент x=100, y от 0 до 100 (1 клетка шириной).
    const door = { c: [100, 0, 100, 100] };
    const width = narrowestDoorCrossed({ x: 0, y: 50 }, { x: 200, y: 50 }, [door], cellPx);
    expect(width).toBe(1);
  });

  it("движение мимо двери, не через неё — null", () => {
    const door = { c: [100, 0, 100, 100] };
    const width = narrowestDoorCrossed({ x: 0, y: 500 }, { x: 200, y: 500 }, [door], cellPx);
    expect(width).toBeNull();
  });

  it("несколько дверей на пути — берёт самую узкую", () => {
    const wide    = { c: [100, 0, 100, 300] };   // 3 клетки
    const narrow  = { c: [300, 0, 300, 50] };    // 0,5 клетки
    const width = narrowestDoorCrossed({ x: 0, y: 25 }, { x: 400, y: 25 }, [wide, narrow], cellPx);
    expect(width).toBe(0.5);
  });

  it("стены без двери (не передали в doorWalls) не участвуют — вызывающая сторона фильтрует заранее", () => {
    // narrowestDoorCrossed не фильтрует door>0 сама — это ответственность
    // combat/squeeze.mjs::doorWallsOnScene. Пустой список — null.
    const width = narrowestDoorCrossed({ x: 0, y: 50 }, { x: 200, y: 50 }, [], cellPx);
    expect(width).toBeNull();
  });
});

describe("isSqueeze", () => {
  it("проём ровно половины Базы — ещё не теснота (без замедления)", () => {
    expect(isSqueeze(1, 2)).toBe(false); // 1 клетка при Базе 2×2
  });

  it("проём уже половины Базы — теснота", () => {
    expect(isSqueeze(0.9, 2)).toBe(true);
  });

  it("крупная База (3×3) — тот же проём, что был нормальным для 2×2, уже теснота", () => {
    expect(isSqueeze(1, 3)).toBe(true); // 1 < 1.5
  });

  it("широкий проём — не теснота даже для крупной Базы", () => {
    expect(isSqueeze(2, 3)).toBe(false);
  });
});
