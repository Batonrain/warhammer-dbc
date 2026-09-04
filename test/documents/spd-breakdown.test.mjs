// test/documents/spd-breakdown.test.mjs
//
// Откуда число (wdbc-zbiz): SPD у персонажа с Размером 4 вдруг видится как 2
// — лист раньше молчал про источник. system.movement.spdBreakdown теперь
// собирает те же 4 слагаемых, что складывает halfMove (Черты/импланты,
// Механика Конструктора, Перевес выключенной брони, Пружинящая Стойка), тем
// же приёмом, что charTotalTooltip у характеристик (documents/actor.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ items = [], ...patch } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 30; // Ag.b 3 → SPD базовая 3
  Object.assign(system, patch);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list,
                  getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("system.movement.spdBreakdown", () => {
  it("без модификаторов — только строка «База»", () => {
    const system = characterWith();
    expect(system.movement.halfMove).toBe(3);
    expect(system.movement.spdBreakdown).toEqual([{ label: "База", value: 3, note: "Ag.b + Размер" }]);
  });

  it("Конструктор (movement.spdBonus) — отдельной строкой, сумма сходится", () => {
    const system = characterWith({ movement: { spdBonus: 2 } });
    expect(system.movement.halfMove).toBe(5); // 3 + 2
    expect(system.movement.spdBreakdown).toEqual([
      { label: "База", value: 3, note: "Ag.b + Размер" },
      { label: "Механика (Конструктор)", value: 2 }
    ]);
  });

  it("Перевес выключенной брони — та же строка, что двигает halfMove", () => {
    // Экипированная выключенная силовая броня с overload spdMod −1 (стр. 233):
    // проще всего через прямое поле system.movement.spdBonus не подходит,
    // проверяем через disabledArmourOverloadTier — но тест уже покрыт в
    // disabled-armour-overload.test.mjs, здесь достаточно Пружинящей Стойки
    // и Механики, которые не требуют предмета брони.
    const system = characterWith({ movement: { spdBonus: -1 }, meleeStance: "springing" });
    // 3 (база) − 1 (Механика) = 2, Пружинящая −2 → clamp до 0.5
    expect(system.movement.halfMove).toBe(0.5);
    expect(system.movement.spdBreakdown).toEqual([
      { label: "База", value: 3, note: "Ag.b + Размер" },
      { label: "Механика (Конструктор)", value: -1 },
      { label: "Пружинящая Стойка", value: -2 },
      { label: "Минимум SPD", value: null, floor: 0.5 }
    ]);
  });

  it("Пружинящая Стойка без клампа — сумма breakdown сходится в halfMove", () => {
    const system = characterWith({ movement: { spdBonus: 3 }, meleeStance: "springing" });
    // 3 (база) + 3 (Механика) − 2 (Стойка) = 4
    expect(system.movement.halfMove).toBe(4);
    expect(system.movement.spdBreakdown.map(b => b.label)).toEqual(["База", "Механика (Конструктор)", "Пружинящая Стойка"]);
  });

  // Повален (стр. 30-31, wdbc-r5o7.2): SPD вдвое — halfMove/move/charge/run
  // делятся на 2, независимо от прочих модификаторов; breakdown несёт
  // отдельную non-additive строку («Повален»), не число, иначе сумма строк
  // разошлась бы с halfMove и ложно показала бы «Минимум SPD».
  it("Повален — halfMove/move/charge/run делятся на 2", () => {
    const system = characterWith({ conditions: { prone: true } });
    expect(system.movement.halfMove).toBe(1.5); // 3 / 2
    expect(system.movement.move).toBe(3);       // 6 / 2
    expect(system.movement.charge).toBe(4.5);   // 9 / 2
    expect(system.movement.run).toBe(9);        // 18 / 2
    expect(system.movement.spdBreakdown).toEqual([
      { label: "База", value: 3, note: "Ag.b + Размер" },
      { label: "Повален", value: null, halved: true }
    ]);
  });

  it("Повален + Механика — сумма делится на 2 целиком, до клампа минимума", () => {
    const system = characterWith({ movement: { spdBonus: 2 }, conditions: { prone: true } });
    // (3 + 2) / 2 = 2.5
    expect(system.movement.halfMove).toBe(2.5);
    expect(system.movement.spdBreakdown.map(b => b.label)).toEqual(["База", "Механика (Конструктор)", "Повален"]);
  });

  it("Повален с очень низким SPD — клампится на 0.5, «Минимум SPD» появляется", () => {
    const system = characterWith({ movement: { spdBonus: -3 }, conditions: { prone: true } });
    // (3 − 3) / 2 = 0 → floor 0.5
    expect(system.movement.halfMove).toBe(0.5);
    expect(system.movement.spdBreakdown.map(b => b.label)).toEqual(
      ["База", "Механика (Конструктор)", "Повален", "Минимум SPD"]);
  });

  it("не Повален — строки «Повален» нет вовсе", () => {
    const system = characterWith();
    expect(system.movement.spdBreakdown.map(b => b.label)).not.toContain("Повален");
  });

  // Потеря стоп/ног (стр. 30-31, wdbc-r5o7.5): «SPD уменьшена вдвое (окр.
  // вниз)» — в отличие от Поваленного, здесь настоящий Math.floor, а не
  // клампится к минимуму 0.5; одной потерянной стопы/ноги уже достаточно.
  it("Потеря одной стопы — halfMove/move/charge/run делятся на 2 с округлением вниз", () => {
    const system = characterWith({ conditions: { lostFeet: true, lostFeetCount: 1 } });
    expect(system.movement.halfMove).toBe(1); // floor(3/2)
    expect(system.movement.move).toBe(3);     // floor(6/2)
    expect(system.movement.charge).toBe(4);   // floor(9/2)
    expect(system.movement.run).toBe(9);      // floor(18/2)
    expect(system.movement.spdBreakdown).toEqual([
      { label: "База", value: 3, note: "Ag.b + Размер" },
      { label: "Потеря стопы/ноги", value: null, halvedFloor: true }
    ]);
  });

  it("Потеря одной ноги — тот же эффект, что и стопа (halvedFloor)", () => {
    const system = characterWith({ conditions: { lostLegs: true, lostLegsCount: 1 } });
    expect(system.movement.halfMove).toBe(1);
    expect(system.movement.spdBreakdown.map(b => b.label)).toContain("Потеря стопы/ноги");
  });

  it("Потеря ОБЕИХ ног — полная неподвижность, а не просто деление", () => {
    const system = characterWith({ conditions: { lostLegs: true, lostLegsCount: 2 } });
    expect(system.movement.halfMove).toBe(0);
    expect(system.movement.move).toBe(0);
    expect(system.movement.charge).toBe(0);
    expect(system.movement.run).toBe(0);
    expect(system.movement.spdBreakdown).toEqual([
      { label: "База", value: 3, note: "Ag.b + Размер" },
      { label: "Потеря обеих ног", value: null, immobile: true }
    ]);
  });

  it("Потеря обеих СТОП (не ног) — делится пополам, но не полная неподвижность", () => {
    const system = characterWith({ conditions: { lostFeet: true, lostFeetCount: 2 } });
    expect(system.movement.halfMove).toBe(1); // floor(3/2), не 0 — «нужен Acrobatics−10», не запрет числа
    expect(system.movement.spdBreakdown.map(b => b.label)).toContain("Потеря стопы/ноги");
  });

  it("Повален + потеря стопы — оба применяются по очереди (÷2, затем floor(÷2))", () => {
    const system = characterWith({ movement: { spdBonus: 3 }, conditions: { prone: true, lostFeet: true, lostFeetCount: 1 } });
    // (3 + 3) = 6 → Повален: 6/2 = 3 → Потеря стопы: floor(3/2) = 1
    expect(system.movement.halfMove).toBe(1);
    expect(system.movement.spdBreakdown.map(b => b.label)).toEqual(
      ["База", "Механика (Конструктор)", "Повален", "Потеря стопы/ноги"]);
  });

  it("нет потери стоп/ног — строки нет вовсе", () => {
    const system = characterWith();
    expect(system.movement.spdBreakdown.map(b => b.label)).not.toContain("Потеря стопы/ноги");
    expect(system.movement.spdBreakdown.map(b => b.label)).not.toContain("Потеря обеих ног");
  });
});
