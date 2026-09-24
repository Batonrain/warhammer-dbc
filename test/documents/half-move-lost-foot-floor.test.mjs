// test/documents/half-move-lost-foot-floor.test.mjs
//
// wdbc-2gn (находка 2 ревью 07.09.2026): module/rules/character/movement.mjs —
// «Потеря стопы/ноги» (стр. 30-31) делит уже клампнутые Math.max(0.5, …)
// числа Поваленного через голый Math.floor, без общего книжного минимума
// SPD 0.5 (стр. 28, тот же порог, что применяется у Поваленного и у блока
// spd-модов). Пример из находки: Ag.b 3, Повален, потеряна стопа —
// halfMove = floor(1.5/2) = 0, при этом move (Полное) тем же проходом
// остаётся 1 — Полудвижение оказывается СТРОГО МЕНЬШЕ половины Полного,
// чего книга не описывает, и подсказка «Минимум SPD» это расхождение не
// подсвечивала (expectedHalfMove считался той же формулой без пола).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith(conditions = {}, lostLimbs = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 30; // Ag.b 3 → база SPD 3, halfMove 3, move 6
  Object.assign(system.conditions, conditions);
  Object.assign(system.lostLimbs, lostLimbs);
  const list = [];
  list.get = () => null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Потеря стопы/ноги — пол SPD 0.5 работает и после Math.floor", () => {
  it("только потеря стопы (без Поваленного): halfMove = floor(3/2) = 1, минимум не нужен", () => {
    const system = characterWith({}, { rightFoot: { lost: true } });
    expect(system.movement.halfMove).toBe(1);
    // wdbc-x1nz.2.91: Полное = урезанный SPD × 2 (книга, «Раны и Урон»), а не
    // floor(6/2) = 3, как закреплял прежний тест.
    expect(system.movement.move).toBe(2);
  });

  it("Повален + потеря стопы: Полудвижение не проваливается ниже 0.5 и не падает ниже половины Полного", () => {
    const system = characterWith({ prone: true }, { rightFoot: { lost: true } });
    // Без фикса: halfMove = floor(1.5/2) = 0, move = floor(3/2) = 1 —
    // Полудвижение (0) оказывается МЕНЬШЕ половины Полного (0.5).
    // wdbc-x1nz.2.91: SPD = max(0.5, floor(1.5/2)) = 0.5, производные от него
    // ×2/×3/×6 (прежде закреплялось 1/2/4 — floor каждого числа отдельно).
    expect(system.movement.halfMove).toBe(0.5);
    expect(system.movement.move).toBe(1);
    expect(system.movement.charge).toBe(1.5);
    expect(system.movement.run).toBe(3);
    // Расхождение с «сырой» формулой обязано подсветиться игроку.
    expect(system.movement.spdBreakdown.some(b => b.label === "Минимум SPD")).toBe(true);
  });

  it("потеря обеих ног по-прежнему обнуляет движение целиком, а не клампится к 0.5", () => {
    const system = characterWith({}, { rightLeg: { lost: true }, leftLeg: { lost: true } });
    expect(system.movement.halfMove).toBe(0);
    expect(system.movement.move).toBe(0);
  });
});
