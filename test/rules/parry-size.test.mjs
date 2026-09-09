// test/rules/parry-size.test.mjs
//
// Стр. 12: «Парирование атаки персонажа, который на 1 Размер больше, требует
// Навык Parry, продвинутый на +10, на 2 – +20, на 3 – +30, на 4+ – вообще
// невозможно.»

import { describe, it, expect } from "vitest";
import { parrySizePenalty } from "../../module/rules/parry-size.mjs";

describe("parrySizePenalty", () => {
  it("атакующий не крупнее — без штрафа", () => {
    expect(parrySizePenalty(3, 3)).toEqual({ steps: 0, mod: 0, impossible: false });
  });

  it("защищающийся КРУПНЕЕ атакующего — без штрафа, не бонус", () => {
    expect(parrySizePenalty(2, 5)).toEqual({ steps: 0, mod: 0, impossible: false });
  });

  it("на 1 Размер больше — −10", () => {
    expect(parrySizePenalty(4, 3)).toEqual({ steps: 1, mod: -10, impossible: false });
  });

  it("на 2 Размера больше — −20", () => {
    expect(parrySizePenalty(5, 3)).toEqual({ steps: 2, mod: -20, impossible: false });
  });

  it("на 3 Размера больше — −30", () => {
    expect(parrySizePenalty(6, 3)).toEqual({ steps: 3, mod: -30, impossible: false });
  });

  it("на 4 Размера больше — вообще невозможно", () => {
    expect(parrySizePenalty(7, 3)).toEqual({ steps: 4, mod: 0, impossible: true });
  });

  it("на 5+ Размеров — тоже невозможно (не растёт дальше)", () => {
    expect(parrySizePenalty(20, 3)).toEqual({ steps: 17, mod: 0, impossible: true });
  });

  it("Крестовой Блок (extraAllowedSteps:1) — предел «невозможно» сдвигается на ступень", () => {
    expect(parrySizePenalty(7, 3, 1)).toEqual({ steps: 4, mod: -40, impossible: false });
    expect(parrySizePenalty(8, 3, 1)).toEqual({ steps: 5, mod: 0, impossible: true });
  });

  it("нечисловые/отсутствующие значения — считаются как 0, не падает", () => {
    expect(parrySizePenalty(undefined, undefined)).toEqual({ steps: 0, mod: 0, impossible: false });
    expect(parrySizePenalty(null, "3")).toEqual({ steps: 0, mod: 0, impossible: false });
  });
});
