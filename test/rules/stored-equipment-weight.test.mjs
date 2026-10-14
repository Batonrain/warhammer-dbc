// test/rules/stored-equipment-weight.test.mjs
//
// Три статуса снаряжения (wdbc-6rj, решение владельца 14.10.2026):
// 1. Используется — надето/в руках/активировано, эффекты применяются.
// 2. Носится — при персонаже, эффектов нет, можно взять в руки.
// 3. Хранится — вне зоны доступа (склад/кузов/каюта).
// «Используется» и «Носится» считаются в Нагрузке, «Хранится» — нет
// (rules/character.mjs, system.stored на предмете).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function itemFor(type, system = {}, overrides = {}) {
  return { id: `${type}-1`, name: "Предмет", type, system, getFlag: () => undefined, ...overrides };
}

/** Персонаж с готовой схемой и набором предметов — тот же приём, что у
 *  test/documents/char-bonus-reaches-armor.test.mjs. */
function characterWith(items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Нагрузка: «Хранится» не весит, «Используется»/«Носится» — весят", () => {
  it("снаряжение (gear) без stored — весит как раньше", () => {
    const system = characterWith([itemFor("gear", { weight: 5 })]);
    expect(system.encumbrance.current).toBe(5);
  });

  it("снаряжение (gear) с stored:true — исключено из Нагрузки", () => {
    const system = characterWith([itemFor("gear", { weight: 5, stored: true })]);
    expect(system.encumbrance.current).toBe(0);
  });

  it("надето (equipped:true) без stored — всё равно весит («Используется» ⊂ Нагрузка)", () => {
    const system = characterWith([itemFor("gear", { weight: 5, equipped: true })]);
    expect(system.encumbrance.current).toBe(5);
  });

  it("оружие с stored:true не весит, без него — весит", () => {
    const carried = characterWith([itemFor("weapon", { weight: 8 })]);
    const stored  = characterWith([itemFor("weapon", { weight: 8, stored: true })]);
    expect(carried.encumbrance.current).toBe(8);
    expect(stored.encumbrance.current).toBe(0);
  });

  it("броня, несущая себя сама (силовая, включена), с stored:true — тоже не весит", () => {
    const system = characterWith([itemFor("armor", {
      weight: 40, equipped: true, armorType: "power", active: true, stored: true
    })]);
    expect(system.encumbrance.current).toBe(0);
  });

  it("смешанный инвентарь: только хранимое выпадает из суммы", () => {
    const system = characterWith([
      itemFor("gear", { weight: 3 }, { id: "a" }),
      itemFor("tool", { weight: 2, stored: true }, { id: "b" }),
      itemFor("drug", { weight: 1, quantity: 2 }, { id: "c" })
    ]);
    expect(system.encumbrance.current).toBe(5); // 3 + 1*2, без спрятанного инструмента
  });
});
