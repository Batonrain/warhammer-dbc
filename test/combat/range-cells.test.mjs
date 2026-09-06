// test/combat/range-cells.test.mjs
//
// computeRangeCells/showRangeCells/showWeaponRangeCells/showMeleeRangeCells
// (wdbc-arqo): подсветка клеток сетки сцены в пределах ГЕОМЕТРИЧЕСКОГО
// радиуса атаки (по прямой от токена), БЕЗ Dijkstra-обхода — в отличие от
// reachable-cells.mjs (движение), дальность атаки не зависит от Трудного
// Ландшафта. Сетка в тесте упрощена до пиксель-клетки == offset {i,j} (та же
// упрощающая договорённость, что и в test/combat/reachable-cells.test.mjs),
// grid.size=1 и grid.distance=1 — метры совпадают с числом клеток.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  computeRangeCells, showRangeCells, showWeaponRangeCells, showMeleeRangeCells, clearRangeCells
} from "../../module/combat/range-cells.mjs";

/** Клетчатая сетка: offset {i,j} == pixel {x,y} == center, клетка = 1 м. */
function makeGrid({ gridless = false } = {}) {
  return {
    type: gridless ? 0 : 1,
    size: 1,
    getOffset: pt => ({ i: pt.x, j: pt.y }),
    getCenterPoint: offset => ({ x: offset.i, y: offset.j }),
    getTopLeftPoint: offset => ({ x: offset.i, y: offset.j })
  };
}

function tokenAt(x, y) {
  return { center: { x, y }, document: { id: "tok1", elevation: 0 } };
}

beforeEach(() => {
  globalThis.CONST = { ...globalThis.CONST, GRID_TYPES: { GRIDLESS: 0, SQUARE: 1 } };
  globalThis.canvas = { ready: true, grid: makeGrid(), scene: { grid: { distance: 1 } } };
  clearRangeCells();
});

describe("computeRangeCells", () => {
  it("клетки в пределах радиуса по прямой (Евклидово), исток не входит", () => {
    const cells = computeRangeCells(tokenAt(0, 0), 2);
    // Круг радиуса 2 на целочисленной сетке: (2,0),(0,2),(-2,0),(0,-2) — по осям;
    // (1,1),(1,-1),(-1,1),(-1,-1) — диагонали (√2≈1.41≤2); (2,1) и т.п. вне (√5>2).
    expect(cells).toContainEqual({ i: 2, j: 0 });
    expect(cells).toContainEqual({ i: 1, j: 1 });
    expect(cells).not.toContainEqual({ i: 2, j: 1 });   // √5 > 2
    expect(cells).not.toContainEqual({ i: 0, j: 0 });   // исток не входит
  });

  it("считает по прямой — не Dijkstra, Трудный Ландшафт значения не имеет (в модуле нет такой зависимости)", () => {
    // Явной проверки региона тут нет намеренно: модуль вообще не читает
    // canvas.scene.regions — геометрический радиус не завязан на ландшафт.
    const cells = computeRangeCells(tokenAt(0, 0), 1);
    expect(cells).toHaveLength(4);   // 4 ортогональных соседа на радиусе 1
  });

  it("Gridless — null, вызывающий берёт кольцо вместо клеток", () => {
    globalThis.canvas.grid = makeGrid({ gridless: true });
    expect(computeRangeCells(tokenAt(0, 0), 5)).toBeNull();
  });

  it("нулевой/отрицательный радиус — пустой список, не бросает", () => {
    expect(computeRangeCells(tokenAt(0, 0), 0)).toEqual([]);
    expect(computeRangeCells(tokenAt(0, 0), -3)).toEqual([]);
  });

  it("регресс (живая проверка wdbc-arqo): при обрезке предохранителем остаются БЛИЖНИЕ клетки, не дальний край", () => {
    // Прежний построчный скан начинал с di=-span (самый дальний ряд квадрата)
    // — на большом радиусе предохранитель срабатывал раньше, чем обход
    // добирался до истока, и подсветка выходила узкой полосой у самого края
    // дальности, а рядом со стрелком было пусто. Радиус 200 м на сетке 1 м —
    // полный диск (~125000 клеток) заведомо больше предохранителя MAX_CELLS
    // (20000), обрезка гарантированно происходит — проверяем, что обрезан
    // диск ИЗНУТРИ НАРУЖУ, а не наоборот.
    const cells = computeRangeCells(tokenAt(0, 0), 200);
    const nearest = Math.min(...cells.map(c => Math.hypot(c.i, c.j)));
    const farthest = Math.max(...cells.map(c => Math.hypot(c.i, c.j)));
    // Ближайшая подсвеченная клетка должна быть буквально рядом со стрелком
    // (1-2 клетки), а не за сотню метров — именно это было сломано.
    expect(nearest).toBeLessThanOrEqual(2);
    // Раз подсветка обрезана (радиус 200 » достижимое число клеток за один
    // тест), дальний край усечения точно меньше запрошенного радиуса.
    expect(farthest).toBeLessThan(200);
  });
});

describe("showRangeCells / showWeaponRangeCells / showMeleeRangeCells", () => {
  beforeEach(() => {
    globalThis.Hooks.on = vi.fn();
    globalThis.Hooks.off = vi.fn();
    globalThis.canvas.interface = {
      grid: { addHighlightLayer: vi.fn(), highlightPosition: vi.fn(), destroyHighlightLayer: vi.fn() }
    };
  });

  it("сеточная сцена — рисует подсветку по клетке на каждую клетку в радиусе, возвращает true", () => {
    const drawn = showRangeCells(tokenAt(0, 0), 1);
    expect(drawn).toBe(true);
    expect(canvas.interface.grid.addHighlightLayer).toHaveBeenCalledWith("wh-range-cells");
    expect(canvas.interface.grid.highlightPosition).toHaveBeenCalledTimes(4);   // радиус=1 → 4 соседа
    expect(Hooks.on).toHaveBeenCalledWith("updateToken", expect.any(Function));
  });

  it("Gridless — не рисует ничего и возвращает false", () => {
    globalThis.canvas.grid = makeGrid({ gridless: true });
    const drawn = showRangeCells(tokenAt(0, 0), 5);
    expect(drawn).toBe(false);
    expect(canvas.interface.grid.highlightPosition).not.toHaveBeenCalled();
  });

  it("повторный вызов чистит предыдущую подсветку", () => {
    showRangeCells(tokenAt(0, 0), 1);
    showRangeCells(tokenAt(0, 0), 1);
    expect(canvas.interface.grid.destroyHighlightLayer).toHaveBeenCalledWith("wh-range-cells");
  });

  it("clearRangeCells снимает хуки и уничтожает слой", () => {
    showRangeCells(tokenAt(0, 0), 1);
    clearRangeCells();
    expect(canvas.interface.grid.destroyHighlightLayer).toHaveBeenCalledWith("wh-range-cells");
    expect(Hooks.off).toHaveBeenCalledWith("updateToken", expect.any(Function));
  });

  it("showWeaponRangeCells — радиус = граница Экстремальной полосы (Rng×3), не деление на полосы", () => {
    // Rng=4: pointBlank=3, short=max(2,3)=3, combat=max(4,3)=4, long=8, extreme=12.
    showWeaponRangeCells(tokenAt(0, 0), 4);
    expect(canvas.interface.grid.highlightPosition).toHaveBeenCalled();
    // Клетка на границе (0,12) должна попасть — иначе радиус посчитан не по extreme.
    expect(canvas.interface.grid.highlightPosition).toHaveBeenCalledWith(
      "wh-range-cells", expect.objectContaining({ x: 0, y: 12 }));
    // Клетка чуть дальше границы — не должна подсвечиваться.
    expect(canvas.interface.grid.highlightPosition).not.toHaveBeenCalledWith(
      "wh-range-cells", expect.objectContaining({ x: 0, y: 13 }));
  });

  it("showWeaponRangeCells — нет Rng, ничего не рисует, возвращает false", () => {
    expect(showWeaponRangeCells(tokenAt(0, 0), 0)).toBe(false);
    expect(canvas.interface.grid.highlightPosition).not.toHaveBeenCalled();
  });

  it("showMeleeRangeCells — радиус = 1.5×grid.distance, подсвечивает только соседей", () => {
    const drawn = showMeleeRangeCells(tokenAt(0, 0));
    expect(drawn).toBe(true);
    // 1.5 м на сетке 1 м/клетка: ортогональные (1 ≤ 1.5) и диагональные
    // (√2≈1.41 ≤ 1.5) соседи входят, клетки на расстоянии 2 — нет.
    expect(canvas.interface.grid.highlightPosition).toHaveBeenCalledTimes(8);
    expect(canvas.interface.grid.highlightPosition).not.toHaveBeenCalledWith(
      "wh-range-cells", expect.objectContaining({ x: 2, y: 0 }));
  });
});
