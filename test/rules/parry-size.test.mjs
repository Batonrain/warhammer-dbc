// test/rules/parry-size.test.mjs
//
// Стр. 12: «Парирование атаки персонажа, который на 1 Размер больше, требует
// Навык Parry, продвинутый на +10, на 2 – +20, на 3 – +30, на 4+ – вообще
// невозможно.» Это условие, допускающее сам тест (сверяется с уже вложенным
// Рангом Навыка), а не штраф к его порогу.

import { describe, it, expect } from "vitest";
import { parrySizeGate } from "../../module/rules/parry-size.mjs";

describe("parrySizeGate", () => {
  it("атакующий не крупнее — разрешено при любом Ранге", () => {
    expect(parrySizeGate(3, 3, -20)).toEqual({ steps: 0, requiredBonus: null, allowed: true, impossible: false });
  });

  it("защищающийся КРУПНЕЕ атакующего — разрешено, шагов 0", () => {
    expect(parrySizeGate(2, 5, -20)).toEqual({ steps: 0, requiredBonus: null, allowed: true, impossible: false });
  });

  it("на 1 Размер больше, Ранг untrained (−20) — недостаточно, требуется +10", () => {
    expect(parrySizeGate(4, 3, -20)).toEqual({ steps: 1, requiredBonus: 10, allowed: false, impossible: false });
  });

  it("на 1 Размер больше, Ранг trained (+10) — разрешено", () => {
    expect(parrySizeGate(4, 3, 10)).toEqual({ steps: 1, requiredBonus: 10, allowed: true, impossible: false });
  });

  it("на 2 Размера больше, Ранг trained (+10) — недостаточно, требуется +20", () => {
    expect(parrySizeGate(5, 3, 10)).toEqual({ steps: 2, requiredBonus: 20, allowed: false, impossible: false });
  });

  it("на 2 Размера больше, Ранг veteran (+20) — разрешено", () => {
    expect(parrySizeGate(5, 3, 20)).toEqual({ steps: 2, requiredBonus: 20, allowed: true, impossible: false });
  });

  it("на 3 Размера больше, Ранг veteran (+20) — недостаточно, требуется +30", () => {
    expect(parrySizeGate(6, 3, 20)).toEqual({ steps: 3, requiredBonus: 30, allowed: false, impossible: false });
  });

  it("на 3 Размера больше, Ранг expert (+30) — разрешено", () => {
    expect(parrySizeGate(6, 3, 30)).toEqual({ steps: 3, requiredBonus: 30, allowed: true, impossible: false });
  });

  it("на 4 Размера больше — вообще невозможно, даже с Ранг expert (+30)", () => {
    expect(parrySizeGate(7, 3, 30)).toEqual({ steps: 4, requiredBonus: null, allowed: false, impossible: true });
  });

  it("на 5+ Размеров — тоже невозможно (не растёт дальше)", () => {
    expect(parrySizeGate(20, 3, 30)).toEqual({ steps: 17, requiredBonus: null, allowed: false, impossible: true });
  });

  it("Крестовой Блок (extraAllowedSteps:1) — предел «невозможно» сдвигается на ступень, но требование Ранга остаётся книжным", () => {
    expect(parrySizeGate(7, 3, 30, 1)).toEqual({ steps: 4, requiredBonus: 40, allowed: false, impossible: false });
    expect(parrySizeGate(8, 3, 30, 1)).toEqual({ steps: 5, requiredBonus: null, allowed: false, impossible: true });
  });

  it("нечисловые/отсутствующие значения — считаются как 0/untrained, не падает", () => {
    expect(parrySizeGate(undefined, undefined, undefined)).toEqual({ steps: 0, requiredBonus: null, allowed: true, impossible: false });
    expect(parrySizeGate(null, "3", null)).toEqual({ steps: 0, requiredBonus: null, allowed: true, impossible: false });
  });
});
