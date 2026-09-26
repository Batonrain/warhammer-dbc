// test/constants/effect-phase-ablative.test.mjs
//
// Максимум аблативного пула (kind:"poolMax") — ВХОД расчёта листа:
// rules/character.mjs клампит по нему system.wounds.ablative. С фазой
// "final" надбавка ложилась ПОСЛЕ клампа, и пул Терминаторской брони или
// «Абсурдно Толстого» обнулялся на каждом пересчёте (живая проверка
// 25.09.2026, wdbc-x1nz.2.86). Уже созданные эффекты выравнивает
// migrations/item-effects.mjs::repairEffectPhases по этому же правилу.

import { describe, it, expect } from "vitest";
import { expectedPhase } from "../../module/constants/effect-keys.mjs";

describe("фаза максимума аблативного пула", () => {
  it("initial — до расчёта листа, а не поверх него", () => {
    expect(expectedPhase("system.wounds.ablativeMax")).toBe("initial");
  });
});
