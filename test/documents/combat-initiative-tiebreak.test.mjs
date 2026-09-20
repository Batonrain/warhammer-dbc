// test/documents/combat-initiative-tiebreak.test.mjs
//
// Стр. 12, wdbc-x1nz.2.25: «Если два персонажа имеют равную Инициативу,
// первым ходит тот, у которого выше Ловкость (А)». Foundry по умолчанию
// (Combat#_sortCombatants) при равенстве сравнивает id — WarhammerCombat
// вставляет сравнение Ловкости между «сравнить итог» и «сравнить id».

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerCombat } from "../../module/documents/combat.mjs";

const combatantWith = (id, initiative, ag) => ({
  id, initiative, actor: { system: { characteristics: { ag: { total: ag } } } }
});

describe("WarhammerCombat#_sortCombatants", () => {
  const combat = new WarhammerCombat();

  it("разная Инициатива — как обычно, по убыванию итога", () => {
    const a = combatantWith("a", 15, 30);
    const b = combatantWith("b", 20, 20);
    expect(combat._sortCombatants(a, b)).toBeGreaterThan(0); // b (выше итог) идёт первым
  });

  it("равная Инициатива — первым тот, у кого выше Ловкость", () => {
    const higherAg = combatantWith("a", 15, 50);
    const lowerAg  = combatantWith("b", 15, 30);
    expect(combat._sortCombatants(higherAg, lowerAg)).toBeLessThan(0);
    expect(combat._sortCombatants(lowerAg, higherAg)).toBeGreaterThan(0);
  });

  it("равная Инициатива И равная Ловкость — откат на сравнение id (стабильный порядок)", () => {
    const a = combatantWith("a", 15, 40);
    const b = combatantWith("b", 15, 40);
    expect(combat._sortCombatants(a, b)).toBe(-1);
    expect(combat._sortCombatants(b, a)).toBe(1);
  });

  it("актор без Ловкости (нет данных) считается за 0, не ломает сравнение", () => {
    const noActor = { id: "a", initiative: 15, actor: null };
    const withAg  = combatantWith("b", 15, 10);
    expect(combat._sortCombatants(noActor, withAg)).toBeGreaterThan(0); // b выше
  });
});
