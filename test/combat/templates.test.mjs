// test/combat/templates.test.mjs
//
// Разовый Шаблон зоны поражения (wdbc-1pa/wdbc-wlwf): здесь проверяется
// только чистая геометрия (перевод метров в пиксели фигуры Region-документа).
// Само размещение (canvas.regions.placeRegion) и поиск токенов —
// canvas-обвязка, foundry-stub.mjs её не эмулирует, проверяется живьём.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { blastCircleShape, sprayConeShape, pxPerMeter } from "../../module/combat/templates.mjs";

describe("шаблон Взрывного — круг", () => {
  it("радиус в пикселях = метры × пикселей-на-метр", () => {
    expect(blastCircleShape(3, 100)).toEqual({ type: "circle", x: 0, y: 0, radius: 300 });
  });

  it("центр фигуры всегда 0;0 — canvas.regions.placeRegion сам двигает превью мышью", () => {
    const shape = blastCircleShape(5, 70);
    expect(shape.x).toBe(0);
    expect(shape.y).toBe(0);
  });
});

describe("шаблон Распыления — конус 30°", () => {
  it("длина в пикселях = метры × пикселей-на-метр, угол по умолчанию 30°", () => {
    expect(sprayConeShape(10, 100)).toEqual({ type: "cone", x: 0, y: 0, radius: 1000, angle: 30, rotation: 0 });
  });

  it("угол переопределяем явно", () => {
    expect(sprayConeShape(4, 50, 60).angle).toBe(60);
  });
});

// wdbc-8zi (п.4): фолбэк раньше отдавал голый grid.size (пикселей на КЛЕТКУ)
// вместо пикселей на МЕТР — на сетке с grid.distance≠1 (клетка = N метров)
// Взрывное/Распыление рисовались бы в N раз крупнее/мельче нужного. Верная
// формула — та же, что canvas.dimensions.distancePixels: size/distance.
describe("pxPerMeter (wdbc-8zi, п.4)", () => {
  const savedCanvas = globalThis.canvas;
  afterEach(() => { globalThis.canvas = savedCanvas; });

  it("canvas.dimensions готов — используется distancePixels напрямую", () => {
    globalThis.canvas = { dimensions: { distancePixels: 141 }, grid: { size: 100, distance: 1 } };
    expect(pxPerMeter()).toBe(141);
  });

  it("dimensions ещё не готов, клетка = 1 метр — фолбэк равен grid.size", () => {
    globalThis.canvas = { grid: { size: 100, distance: 1 } };
    expect(pxPerMeter()).toBe(100);
  });

  it("dimensions не готов, клетка = 2 метра — фолбэк делит на distance, а не отдаёт голый size", () => {
    globalThis.canvas = { grid: { size: 100, distance: 2 } };
    expect(pxPerMeter()).toBe(50);
  });

  it("canvas.grid тоже недоступен — берётся canvas.scene.grid с тем же делением", () => {
    globalThis.canvas = { scene: { grid: { size: 140, distance: 2 } } };
    expect(pxPerMeter()).toBe(70);
  });

  it("канваса нет вовсе — дефолт 100", () => {
    globalThis.canvas = undefined;
    expect(pxPerMeter()).toBe(100);
  });
});
