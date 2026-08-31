// test/combat/reachable-cells.test.mjs
//
// computeReachableCells/showReachableCells (wdbc-rgi8, L-ступень wdbc-fb2d):
// Dijkstra flood-fill клеток сетки, достижимых от токена в пределах бюджета
// SPD×N, с удвоением стоимости клетки под Трудным Ландшафтом. Сетка в тесте
// упрощена до 4-связной (только ортогональные соседи), пиксель клетки ==
// её offset {i,j} — упрощение не меняет проверяемую логику (BFS/Dijkstra по
// стоимости), только избавляет тест от реальной пиксельной геометрии.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { computeReachableCells, showReachableCells, clearReachableCells } from "../../module/combat/reachable-cells.mjs";
import { DIFFICULT_TERRAIN_TYPE } from "../../module/regions/difficult-terrain.mjs";

/** 4-связная клетчатая сетка: offset {i,j} == pixel {x,y} == center. */
function makeGrid({ gridless = false } = {}) {
  return {
    type: gridless ? 0 : 1,
    getOffset: pt => ({ i: pt.i, j: pt.j }),
    getCenterPoint: offset => ({ x: offset.i, y: offset.j }),
    getTopLeftPoint: offset => ({ x: offset.i, y: offset.j }),
    getAdjacentOffsets: offset => ([
      { i: offset.i + 1, j: offset.j }, { i: offset.i - 1, j: offset.j },
      { i: offset.i, j: offset.j + 1 }, { i: offset.i, j: offset.j - 1 }
    ]),
    measurePath: () => ({ distance: 1 })
  };
}

function terrainRegion(cells) {
  return {
    behaviors: [{ type: DIFFICULT_TERRAIN_TYPE, disabled: false }],
    testPoint: ({ x, y }) => cells.has(`${x},${y}`)
  };
}

function tokenAt(i, j) {
  return { center: { i, j }, document: { id: "tok1", elevation: 0 } };
}

beforeEach(() => {
  globalThis.CONST = { ...globalThis.CONST, GRID_TYPES: { GRIDLESS: 0, SQUARE: 1 } };
  globalThis.canvas = { ready: true, grid: makeGrid(), scene: { regions: [] } };
  clearReachableCells();
});

describe("computeReachableCells", () => {
  it("без ландшафта — все клетки в пределах бюджета (Manhattan-расстояние ≤ budget)", () => {
    const cells = computeReachableCells(tokenAt(0, 0), 2);
    // dist=1: 4 клетки, dist=2: 8 клеток (4 осевых + 4 диагональных двухшаговых) — 12 всего.
    expect(cells).toHaveLength(12);
    expect(cells).toContainEqual({ i: 2, j: 0 });
    expect(cells).toContainEqual({ i: 1, j: 1 });
    expect(cells).not.toContainEqual({ i: 3, j: 0 });
    expect(cells).not.toContainEqual({ i: 0, j: 0 });   // исток не входит в список
  });

  it("Трудный Ландшафт удваивает стоимость клетки — блокирует иначе достижимые клетки", () => {
    globalThis.canvas.scene.regions = [terrainRegion(new Set(["1,0"]))];
    const cells = computeReachableCells(tokenAt(0, 0), 2);
    // (1,0) стоит 1×2=2 — всё ещё в бюджете.
    expect(cells).toContainEqual({ i: 1, j: 0 });
    // (2,0) через (1,0) стоил бы 2+1=3 — обходных путей ≤2 нет, клетка выпадает.
    expect(cells).not.toContainEqual({ i: 2, j: 0 });
    // Без ландшафта эта же клетка была реальной (см. тест выше) — подтверждает,
    // что разница вызвана именно удвоением, а не багом бюджета.
  });

  it("бюджет Бега не обрезается потолком обхода (SPD×6 ≈ 30 клеток)", () => {
    // 4-связная сетка: клеток на манхэттенском расстоянии ≤ b ровно 2b(b+1).
    // При потолке в 600 клеток подсветка Бега молча показывала бы круг меньше
    // настоящего — проверяем полное число клеток, а не «не пусто».
    const cells = computeReachableCells(tokenAt(0, 0), 30);
    expect(cells).toHaveLength(2 * 30 * 31);
  });

  it("Gridless — null, вызывающий берёт круг вместо клеток", () => {
    globalThis.canvas.grid = makeGrid({ gridless: true });
    expect(computeReachableCells(tokenAt(0, 0), 5)).toBeNull();
  });

  it("нулевой/отрицательный бюджет — пустой список, не бросает", () => {
    expect(computeReachableCells(tokenAt(0, 0), 0)).toEqual([]);
    expect(computeReachableCells(tokenAt(0, 0), -3)).toEqual([]);
  });
});

describe("showReachableCells", () => {
  beforeEach(() => {
    globalThis.Hooks.on = vi.fn();
    globalThis.Hooks.off = vi.fn();
    globalThis.canvas.interface = {
      grid: { addHighlightLayer: vi.fn(), highlightPosition: vi.fn(), destroyHighlightLayer: vi.fn() }
    };
  });

  it("сеточная сцена — рисует подсветку по клетке на каждую достижимую клетку, возвращает true", () => {
    const drawn = showReachableCells(tokenAt(0, 0), 1);
    expect(drawn).toBe(true);
    expect(canvas.interface.grid.addHighlightLayer).toHaveBeenCalledWith("wh-reach-cells");
    expect(canvas.interface.grid.highlightPosition).toHaveBeenCalledTimes(4);   // budget=1 → 4 соседа
    expect(Hooks.on).toHaveBeenCalledWith("updateToken", expect.any(Function));
    expect(Hooks.on).toHaveBeenCalledWith("deleteToken", expect.any(Function));
    expect(Hooks.on).toHaveBeenCalledWith("canvasReady", expect.any(Function));
  });

  it("Gridless — не рисует ничего и возвращает false (вызывающий берёт круг)", () => {
    globalThis.canvas.grid = makeGrid({ gridless: true });
    const drawn = showReachableCells(tokenAt(0, 0), 5);
    expect(drawn).toBe(false);
    expect(canvas.interface.grid.highlightPosition).not.toHaveBeenCalled();
  });

  it("повторный вызов чистит предыдущую подсветку", () => {
    showReachableCells(tokenAt(0, 0), 1);
    showReachableCells(tokenAt(0, 0), 1);
    expect(canvas.interface.grid.destroyHighlightLayer).toHaveBeenCalledWith("wh-reach-cells");
  });

  it("clearReachableCells снимает хуки и уничтожает слой", () => {
    showReachableCells(tokenAt(0, 0), 1);
    clearReachableCells();
    expect(canvas.interface.grid.destroyHighlightLayer).toHaveBeenCalledWith("wh-reach-cells");
    expect(Hooks.off).toHaveBeenCalledWith("updateToken", expect.any(Function));
  });
});
