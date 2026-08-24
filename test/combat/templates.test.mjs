// test/combat/templates.test.mjs
//
// Разовый Шаблон зоны поражения (wdbc-1pa/wdbc-wlwf): здесь проверяется
// только чистая геометрия (перевод метров в пиксели фигуры Region-документа).
// Само размещение (canvas.regions.placeRegion) и поиск токенов —
// canvas-обвязка, foundry-stub.mjs её не эмулирует, проверяется живьём.

import { describe, it, expect } from "vitest";
import { blastCircleShape, sprayConeShape } from "../../module/combat/templates.mjs";

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
