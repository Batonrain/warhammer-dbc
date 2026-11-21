// Скульптор Плоти: Ритуал Лепки Плоти и ветви (21.11.2026).
import { describe, it, expect } from "vitest";
import {
  FLESHMOLD_TRAITS, fleshmoldModifier, sculpturiteMedicaeBonus, donorDice, fleshmoldTotal, fleshmoldCritFormula,
  fleshmoldCritLevel, fleshmoldPlanCost, fleshmoldPlanCheck, malleableAfterHour, trimGrantsToBudget, eidolonGain
} from "../../module/rules/flesh-sculptor-talents.mjs";

describe("Скульптор Плоти", () => {
  it("поправка ритуала: −10, +20 не доброволец, +10 за близкого, +Скульптурит", () => {
    expect(fleshmoldModifier()).toBe(-10);
    expect(fleshmoldModifier({ unwilling: true, friends: 2, sculpturiteBonus: 15 })).toBe(45);
  });
  it("Скульптурит: +Cor.b×5 только на своём", () => {
    const sc = { uuid: "Actor.s", items: [{ name: "Sculpturite / Скульптурит", type: "talent" }], system: { corruptionBonus: 3 } };
    expect(sculpturiteMedicaeBonus(sc, { flags: { "warhammer-dbc": { sculpturiteOf: "Actor.s" } } })).toBe(15);
    expect(sculpturiteMedicaeBonus(sc, { flags: { "warhammer-dbc": { sculpturiteOf: "Actor.x" } } })).toBe(0);
  });
  it("доноры: до 6 по 1d5; повторный ритуал не хуже прежнего, Аполион — сумма", () => {
    expect(donorDice(9)).toBe(6);
    expect(fleshmoldTotal({ prev: 5, gained: 3 })).toBe(5);
    expect(fleshmoldTotal({ prev: 5, gained: 3, appolyon: true })).toBe(8);
  });
  it("Провал: R крит 1d10−2+Провалы, уровень 1..10", () => {
    expect(fleshmoldCritFormula(2)).toBe("1d10-2+2");
    expect(fleshmoldCritLevel(-1)).toBe(1);
    expect(fleshmoldCritLevel(13)).toBe(10);
  });
  it("раскладка: Трейт без рейтинга 1, рейтинг до 6, не дороже запаса", () => {
    expect(FLESHMOLD_TRAITS.filter(t => t.charKey)).toHaveLength(9);
    expect(fleshmoldPlanCost({ amphibious: 1, armour: 3, "uc:t": 2 })).toBe(6);
    expect(fleshmoldPlanCheck({ armour: 7 }, 10).ok).toBe(false);
    expect(fleshmoldPlanCheck({ armour: 3, sturdy: 1 }, 3).ok).toBe(false);
    expect(fleshmoldPlanCheck({ armour: 2, sturdy: 1 }, 3).ok).toBe(true);
  });
  it("Безумно Податливый: Провал часа снимает Успехи и последние Трейты", () => {
    expect(malleableAfterHour(4, { success: false, deg: 2 })).toBe(2);
    expect(malleableAfterHour(4, { success: true, deg: 3 })).toBe(4);
    const r = trimGrantsToBudget([{ key: "sturdy", rating: 1 }, { key: "armour", rating: 2 }], 1);
    expect(r.keep.map(g => g.key)).toEqual(["sturdy"]);
    expect(r.drop.map(g => g.key)).toEqual(["armour"]);
  });
  it("Эйдолон: Плоть = T.b жертвы", () => {
    expect(eidolonGain(4)).toBe(4);
  });
});
