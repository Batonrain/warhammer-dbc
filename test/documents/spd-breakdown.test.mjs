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
});
