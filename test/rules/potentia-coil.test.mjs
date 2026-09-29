// test/rules/potentia-coil.test.mjs
//
// Катушка Потенции и Электу-Индукторы (Импланты Механикум, книга):
//  • «Персонаж может тратить заряды, снимая Усталость по цене 2к1» —
//    2 заряда ⚡ за 1 Усталости;
//  • «заряжать Катушки Потенции … тестом Tech-Use+0, восстанавливая 1 заряд
//    за каждый Успех до максимума».

import { describe, it, expect } from "vitest";
import { COIL_FATIGUE_COST, coilFatigueRelief, electooChargeGain } from "../../module/rules/potentia-coil.mjs";

describe("Катушка Потенции: Усталость за заряды 2к1", () => {
  it("цена — 2 заряда", () => expect(COIL_FATIGUE_COST).toBe(2));

  it("снимает 1 Усталости за 2 заряда", () => {
    expect(coilFatigueRelief({ energy: 5, fatigue: 3 })).toEqual({ ok: true, energy: 3, fatigue: 2 });
  });

  it("зарядов меньше двух — нельзя", () => {
    expect(coilFatigueRelief({ energy: 1, fatigue: 3 })).toMatchObject({ ok: false, reason: "energy" });
  });

  it("Усталости нет — нельзя (заряды не тратятся впустую)", () => {
    expect(coilFatigueRelief({ energy: 7, fatigue: 0 })).toMatchObject({ ok: false, reason: "fatigue" });
  });
});

describe("Электу-Индукторы: 1 заряд за Успех до максимума", () => {
  it("успех на 3 Успеха — +3", () => {
    expect(electooChargeGain({ success: true, deg: 3, energy: 0, max: 7 })).toBe(3);
  });
  it("не выше максимума Катушки", () => {
    expect(electooChargeGain({ success: true, deg: 5, energy: 4, max: 5 })).toBe(1);
  });
  it("провал — ничего", () => {
    expect(electooChargeGain({ success: false, deg: 2, energy: 0, max: 5 })).toBe(0);
  });
});
