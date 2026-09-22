// test/rules/weapon-length.test.mjs
//
// Длина Оружия (wdbc-x1nz.2.67, стр. 39): действующий Rng рукопашного
// оружия (база + Хват + Приём) и правила сравнения поверх него.

import { describe, it, expect } from "vitest";
import { meleeEffectiveRange } from "../../module/constants/combat.mjs";
import { actorMaxMeleeRange, longerWeaponBonus, chargeTargetDodgeBonus,
         closeQuartersPenalty, extendedReachCells, meleeContactDisplay } from "../../module/rules/weapon-length.mjs";

function meleeWeapon({ range = 0, grips = "1р", equipped = true } = {}) {
  return { type: "weapon", system: { weaponClass: "melee", range, grips, equipped } };
}

describe("meleeEffectiveRange — действующий Rng атаки", () => {
  it("голая база, без Хвата/Приёма", () => {
    expect(meleeEffectiveRange(4, null, "standard")).toBe(4);
  });

  it("Одноручный (1р) хват прибавляет +1 (GRIPS['1р'].rngMod)", () => {
    expect(meleeEffectiveRange(4, "1р", "standard")).toBe(5);
  });

  it("Обратный (Об) хват −2, до минимума 0", () => {
    expect(meleeEffectiveRange(1, "Об", "standard")).toBe(0);
    expect(meleeEffectiveRange(4, "Об", "standard")).toBe(2);
  });

  it("Кулачный (Кл) хват принудительно ставит Rng в 0 (rngSet), а не вычитает", () => {
    expect(meleeEffectiveRange(6, "Кл", "standard")).toBe(0);
  });

  it("Приём Выпад — +1 к Rng для этой атаки", () => {
    expect(meleeEffectiveRange(4, null, "thrust")).toBe(5);
  });

  it("Приём Пила — Rng падает до 0 для этой атаки, независимо от базы", () => {
    expect(meleeEffectiveRange(6, "1р", "saw")).toBe(0);
  });

  it("Выпад и Хват складываются", () => {
    expect(meleeEffectiveRange(4, "1р", "thrust")).toBe(6);
  });

  it("итог никогда не уходит в минус", () => {
    expect(meleeEffectiveRange(0, "Об", "standard")).toBe(0);
  });
});

describe("actorMaxMeleeRange — максимальная длина экипированного рукопашного оружия", () => {
  it("нет оружия — 0", () => {
    expect(actorMaxMeleeRange({ items: [] })).toBe(0);
    expect(actorMaxMeleeRange(null)).toBe(0);
  });

  it("берёт максимум среди нескольких экипированных (grips по умолчанию «1р», rngMod +1)", () => {
    const actor = { items: [meleeWeapon({ range: 2 }), meleeWeapon({ range: 4 })] };
    expect(actorMaxMeleeRange(actor)).toBe(5); // range 4 + rngMod("1р") +1
  });

  it("неэкипированное оружие не считается", () => {
    const actor = { items: [meleeWeapon({ range: 9, equipped: false }), meleeWeapon({ range: 2 })] };
    expect(actorMaxMeleeRange(actor)).toBe(3); // только range 2 + rngMod("1р") +1
  });

  it("дальнобойное оружие в инвентаре не участвует", () => {
    const actor = { items: [
      { type: "weapon", system: { weaponClass: "basic", range: 100, equipped: true, grips: "2р" } },
      meleeWeapon({ range: 2 }),
    ] };
    expect(actorMaxMeleeRange(actor)).toBe(3);
  });
});

describe("longerWeaponBonus — правило 1 (стр. 39): длиннее оружия цели → +5", () => {
  it("атакующий длиннее максимума цели — бонус есть", () => {
    const target = { items: [meleeWeapon({ range: 2 })] }; // эфф. 3
    expect(longerWeaponBonus(5, target)).toBe(true);
  });

  it("равная или меньшая длина — бонуса нет", () => {
    const target = { items: [meleeWeapon({ range: 4 })] }; // эфф. 5
    expect(longerWeaponBonus(5, target)).toBe(false);
    expect(longerWeaponBonus(4, target)).toBe(false);
  });

  it("нет цели — бонуса нет", () => {
    expect(longerWeaponBonus(10, null)).toBe(false);
  });
});

describe("chargeTargetDodgeBonus — правило 2 (стр. 39): Натиск на цель с оружием на 3+ длиннее", () => {
  it("разница 3+ — у цели бонус Избегания", () => {
    expect(chargeTargetDodgeBonus(2, 5)).toBe(true);
    expect(chargeTargetDodgeBonus(0, 3)).toBe(true);
  });

  it("разница меньше 3 — бонуса нет", () => {
    expect(chargeTargetDodgeBonus(2, 4)).toBe(false);
  });

  it("атакующий длиннее или равен — бонуса нет", () => {
    expect(chargeTargetDodgeBonus(6, 4)).toBe(false);
    expect(chargeTargetDodgeBonus(4, 4)).toBe(false);
  });
});

describe("closeQuartersPenalty — правило 4 (стр. 39): штраф вблизи для Rng ≥6", () => {
  it("Rng 5 и ниже — без штрафа", () => {
    expect(closeQuartersPenalty(5)).toBe(0);
    expect(closeQuartersPenalty(0)).toBe(0);
  });

  it("Rng 6 — −5 (1 пункт выше 5)", () => {
    expect(closeQuartersPenalty(6)).toBe(-5);
  });

  it("Rng 9 — −20 (4 пункта выше 5)", () => {
    expect(closeQuartersPenalty(9)).toBe(-20);
  });
});

describe("extendedReachCells — правило 3 (стр. 39, wdbc-x1nz.2.67.1): зазор длинного оружия", () => {
  it("Rng 7 и ниже — 0 (обычный Базовый контакт)", () => {
    expect(extendedReachCells(7)).toBe(0);
    expect(extendedReachCells(0)).toBe(0);
  });

  it("Rng 8 — 1 клетка", () => {
    expect(extendedReachCells(8)).toBe(1);
  });

  it("Rng 9 и выше — 2 клетки", () => {
    expect(extendedReachCells(9)).toBe(2);
    expect(extendedReachCells(12)).toBe(2);
  });
});

describe("meleeContactDisplay — контакт с поправкой на правило 3", () => {
  it("Базовый/Глубокий контакт не трогается независимо от Rng", () => {
    expect(meleeContactDisplay("base", 0, 8)).toBe("base");
    expect(meleeContactDisplay("deep", 0, 0)).toBe("deep");
  });

  it("нет контакта, обычное оружие (Rng < 8) — остаётся none", () => {
    expect(meleeContactDisplay("none", 1, 7)).toBe("none");
  });

  it("нет контакта, Rng 8, зазор ровно 1 клетка — reach", () => {
    expect(meleeContactDisplay("none", 1, 8)).toBe("reach");
  });

  it("нет контакта, Rng 8, зазор 2 клетки — вне досягаемости, none", () => {
    expect(meleeContactDisplay("none", 2, 8)).toBe("none");
  });

  it("нет контакта, Rng 9, зазор 2 клетки — reach", () => {
    expect(meleeContactDisplay("none", 2, 9)).toBe("reach");
  });

  it("нет контакта, Rng 9, зазор 3 клетки — вне досягаемости, none", () => {
    expect(meleeContactDisplay("none", 3, 9)).toBe("none");
  });
});
