// Чумной Монах: рейтинг Unnatural T как кошелёк (21.11.2026).
import { describe, it, expect } from "vitest";
import {
  feverState, feverSpendPlan, feverRestorePlan, feverUnarmedLimit, trueRotDamage, trueRotRadCap,
  corpsePoisonAttack, trueRotBypassesImmunity, wormPouchCap
} from "../../module/rules/plague-monk-talents.mjs";

const unT = r => ({ name: `Unnatural Toughness / Сверхъестественная Стойкость (${r})`, type: "trait",
  system: { rating: r, effects: { charBonusStat: "t", charBonusValue: r } } });
const gl = { name: "Gluttony / Чревоугодие", type: "talent" };
const monk = (items, fever = {}, cor = 3) => ({ items, system: { corruptionBonus: cor }, flags: { "warhammer-dbc": { feverT: fever } } });

describe("Чумной Монах", () => {
  it("кошелёк: рейтинг Трейта + delta, потолок Cor.b+2", () => {
    const st = feverState(monk([unT(2)], { delta: -1 }));
    expect(st).toMatchObject({ base: 2, current: 1, cap: 5, excess: 0, excessCap: 0, available: 1 });
  });
  it("трата: сперва «лишние» Чревоугодия, потом рейтинг; не в минус", () => {
    const st = feverState(monk([unT(2), gl], { delta: 3, excess: 1 }));
    expect(feverSpendPlan(st, 2)).toMatchObject({ ok: true, excess: 0, delta: 2, fromExcess: 1 });
    expect(feverSpendPlan(feverState(monk([unT(2)])), 3).ok).toBe(false);
  });
  it("пожирание: до потолка, остаток — в лишние (2 за копию), остальное пропадает", () => {
    const st = feverState(monk([unT(2), gl, gl], { delta: -1 }));
    const p = feverRestorePlan(st, 9);
    expect(p).toMatchObject({ toRating: 4, toExcess: 4, lost: 1, delta: 3, excess: 4 });
    expect(feverRestorePlan(feverState(monk([unT(2)])), 5)).toMatchObject({ toRating: 3, toExcess: 0, lost: 2 });
  });
  it("числа Талантов", () => {
    expect(feverUnarmedLimit(5)).toBe(2);
    expect(trueRotDamage("1d10")).toBe("2d10");
    expect(trueRotDamage("1d5")).toBe("1d5");
    expect(trueRotRadCap(5)).toBe(2);
    expect(wormPouchCap({ system: { corruptionBonus: 4 } })).toBe(4);
  });
  it("Трупный Яд — только безоружная; Истинная Гниль пробивает Daemonic/Machine/SoN", () => {
    const m = monk([{ name: "Corpse Poison / Трупный Яд", type: "trait" }]);
    expect(corpsePoisonAttack(m, true)).toBe(true);
    expect(corpsePoisonAttack(m, false)).toBe(false);
    expect(trueRotBypassesImmunity({ items: [{ name: "Daemonic (3) / Демонический", type: "trait" }] })).toBe(true);
    expect(trueRotBypassesImmunity({ items: [] })).toBe(false);
  });
});
