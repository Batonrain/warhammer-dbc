// test/rules/tactical-map.test.mjs
//
// Тактическая карта (wdbc-8k0i): Базы 2×2/3×3, Дистанции от края/от центра
// с округлением в разные стороны, Виды контакта none/base/deep.

import { describe, it, expect } from "vitest";
import { baseSizeCells, edgeDistanceMeters, centerDistanceMeters, contactType,
         BASE_SIZE_DEFAULT, BASE_SIZE_LARGE }
  from "../../module/rules/tactical-map.mjs";

describe("размер Базы", () => {
  it("по умолчанию 2×2, даже у Космодесантника с характеристикой Размер 1", () => {
    expect(baseSizeCells()).toBe(BASE_SIZE_DEFAULT);
    expect(baseSizeCells({ raceLarge: false, armorLarge: false })).toBe(2);
  });

  it("крупная раса (Огрин) даёт 3×3", () => {
    expect(baseSizeCells({ raceLarge: true })).toBe(BASE_SIZE_LARGE);
  });

  it("крупная броня (Терминаторская) даёт 3×3 независимо от расы", () => {
    expect(baseSizeCells({ raceLarge: false, armorLarge: true })).toBe(3);
  });

  it("оба флага сразу — всё равно 3×3, не больше", () => {
    expect(baseSizeCells({ raceLarge: true, armorLarge: true })).toBe(3);
  });
});

describe("дистанция от края Базы до края Базы (стрельба)", () => {
  it("вплотную (базовый контакт) — 0 м", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 2, y: 0, w: 2, h: 2 };
    expect(edgeDistanceMeters(a, b)).toBe(0);
  });

  it("округляет вверх — 4.05 клетки даёт 5 м, не 4", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 6, y: 0, w: 2, h: 2 }; // центры в 6 клетках, минус радиусы 1+1 = 4 ровно
    // сдвигаем на дробную клетку, чтобы проверить именно округление вверх
    const bFrac = { x: 6.05, y: 0, w: 2, h: 2 };
    expect(edgeDistanceMeters(a, b)).toBe(4);
    expect(edgeDistanceMeters(a, bFrac)).toBe(5);
  });

  it("диагональ считается по линейке (Евклидово), не по клеткам", () => {
    // Центры на (1,1) и (4,5) — расстояние центров 5 клеток ровно (3-4-5),
    // минус радиусы 1+1 = 3 м. По клеточному счёту (Chebyshev) было бы 4.
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 3, y: 4, w: 2, h: 2 };
    expect(edgeDistanceMeters(a, b)).toBe(3);
  });

  it("метры на клетку масштабируют результат", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 8, y: 0, w: 2, h: 2 };
    expect(edgeDistanceMeters(a, b, 2)).toBe(12); // (8-2)*2
  });
});

describe("дистанция от центра к центру (движение)", () => {
  it("округляет вниз", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 3, y: 4, w: 2, h: 2 }; // центры ровно в 5 клетках
    expect(centerDistanceMeters(a, b)).toBe(5);
    const bFrac = { x: 3, y: 4.9, w: 2, h: 2 };
    expect(centerDistanceMeters(a, bFrac)).toBeLessThan(6);
  });
});

describe("виды контакта", () => {
  it("Базы далеко друг от друга — none", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 10, y: 10, w: 2, h: 2 };
    expect(contactType(a, b)).toBe("none");
  });

  it("грани Баз соприкасаются — base", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 2, y: 0, w: 2, h: 2 };
    expect(contactType(a, b)).toBe("base");
  });

  it("Базы налагаются (перенос раненого) — deep", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 1, y: 1, w: 2, h: 2 };
    expect(contactType(a, b)).toBe("deep");
  });
});
