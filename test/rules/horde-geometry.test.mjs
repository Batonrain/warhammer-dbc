// test/rules/horde-geometry.test.mjs
//
// Клетки под токенами Орды. От этого счёта зависят два правила: «Прячась в
// Орде» (токен персонажа наложен на токен Орды) и «Орда против Орды» (чужая
// Орда считается за столько персонажей, сколько клеток базового контакта).

import { describe, it, expect } from "vitest";
import { rectCells, cellInRect, overlapCells, rectsOverlap,
         contactCells, rectsInContact, hordeVsHordeTargets }
  from "../../module/rules/horde-geometry.mjs";

describe("клетки прямоугольника", () => {
  it("токен 3×2 занимает шесть клеток", () => {
    expect(rectCells({ x: 5, y: 5, w: 3, h: 2 })).toHaveLength(6);
  });

  it("токен без размеров занимает одну клетку — свою", () => {
    expect(rectCells({ x: 2, y: 3 })).toEqual([{ x: 2, y: 3 }]);
  });

  it("клетка внутри и снаружи различаются по краю, а не по центру", () => {
    const r = { x: 0, y: 0, w: 2, h: 2 };
    expect(cellInRect({ x: 1, y: 1 }, r)).toBe(true);
    expect(cellInRect({ x: 2, y: 1 }, r)).toBe(false);
  });
});

describe("наложение токенов — «Прячась в Орде»", () => {
  it("персонаж, стоящий внутри Орды, накладывается на неё", () => {
    const horde = { x: 0, y: 0, w: 4, h: 4 };
    expect(rectsOverlap({ x: 2, y: 2 }, horde)).toBe(true);
  });

  it("персонаж рядом с Ордой — не в ней", () => {
    expect(rectsOverlap({ x: 4, y: 2 }, { x: 0, y: 0, w: 4, h: 4 })).toBe(false);
  });

  it("частичное наложение крупного токена считается клетками", () => {
    expect(overlapCells({ x: 3, y: 3, w: 2, h: 2 }, { x: 0, y: 0, w: 4, h: 4 })).toBe(1);
  });
});

describe("базовый контакт — «Орда против Орды»", () => {
  it("два строя лицом к лицу соприкасаются по всей ширине", () => {
    const a = { x: 0, y: 0, w: 3, h: 3 };
    const b = { x: 3, y: 0, w: 3, h: 3 };
    expect(contactCells(a, b)).toMatchObject({ a: 3, b: 3 });
  });

  it("соприкасаются только крайние колонки, а не весь фронт", () => {
    const wide   = { x: 0, y: 0, w: 5, h: 2 };
    const narrow = { x: 5, y: 0, w: 2, h: 2 };
    // Ширина строя роли не играет: до чужого строя достаёт только та колонка,
    // что стоит вплотную, — по клетке на строку.
    const { a, b } = contactCells(wide, narrow);
    expect(a).toBe(2);
    expect(b).toBe(2);
  });

  it("диагональное касание углами — тоже контакт", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 2, y: 2, w: 2, h: 2 };
    expect(rectsInContact(a, b)).toBe(true);
    expect(rectsInContact(a, b, { diagonal: false })).toBe(false);
  });

  it("между строями клетка — контакта нет", () => {
    expect(rectsInContact({ x: 0, y: 0, w: 3, h: 3 }, { x: 4, y: 0, w: 3, h: 3 })).toBe(false);
  });

  it("Орда считает соседнюю Орду за столько персонажей, сколько клеток та выставила", () => {
    const attacker = { x: 0, y: 0, w: 6, h: 2 };
    const defender = { x: 6, y: 0, w: 2, h: 4 };
    // Защитник глубже атакующего: до чужого строя достают три клетки его левой
    // колонки — две напротив и одна наискось. Четвёртая уже вне досягаемости.
    expect(hordeVsHordeTargets(attacker, defender)).toBe(3);
    // Со стороны атакующего клеток контакта только две — но считаем не их.
    expect(contactCells(attacker, defender).a).toBe(2);
  });

  it("разошедшиеся Орды не дают целей вовсе", () => {
    expect(hordeVsHordeTargets({ x: 0, y: 0, w: 2, h: 2 }, { x: 9, y: 9, w: 2, h: 2 })).toBe(0);
  });

  it("наложенные друг на друга Орды дают минимум одну цель", () => {
    expect(hordeVsHordeTargets({ x: 0, y: 0, w: 3, h: 3 }, { x: 0, y: 0, w: 3, h: 3 })).toBe(1);
  });
});
