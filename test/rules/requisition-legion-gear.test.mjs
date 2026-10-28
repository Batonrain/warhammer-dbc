// test/rules/requisition-legion-gear.test.mjs
//
// Древний Воин: «уменьшает Редкость всего Легион снаряжения на 1» (стр. 62).
// Решение владельца 26.10.2026: признак «Легион» нужен и броне, и прочему
// снаряжению. У оружия это свойство Legion (weaponProps), у остального —
// булево поле схемы `system.legion` (броня, снаряжение, инструмент, боеприпас,
// щит). Тест гоняется на НАСТОЯЩИХ документах packs-src, пропущенных через
// схему: поле, забытое в defineSchema, молча пропало бы при первой правке
// предмета в игре.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { ITEM_DATA_MODELS } from "../../module/data/index.mjs";
import { itemClass, requisitionPlan } from "../../module/rules/requisition.mjs";
import { gearObjects } from "../../module/apps/gear-grant.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const AW = { items: [{ type: "talent", name: "Ancient Warrior / Древний Воин", system: {} }], system: {} };

/** Первый настоящий документ пака этого типа, прогнанный через схему. */
function realItem(pack, type, extra = {}) {
  const { doc } = packDocuments(pack, type).find(d => d.doc.system?.availability != null) ?? packDocuments(pack, type)[0];
  const model = new ITEM_DATA_MODELS[type](structuredClone({ ...doc.system, ...extra }));
  return { type, name: doc.name, system: model.toObject() };
}

describe("признак «Легион» у брони и прочего снаряжения", () => {
  const TYPES = [["armor", "armor"], ["gear", "gear"], ["tools", "tool"], ["ammunition", "ammo"], ["shields", "forcefield"]];

  for (const [pack, type] of TYPES) {
    it(`${type}: поле legion живёт в схеме и сохраняется (настоящий документ пака ${pack})`, () => {
      const plain = realItem(pack, type);
      expect(plain.system.legion).toBe(false);
      expect(itemClass(plain).legion).toBe(false);
      const legion = realItem(pack, type, { legion: true });
      expect(legion.system.legion).toBe(true);
      expect(itemClass(legion).legion).toBe(true);
    });
  }

  it("Древний Воин снижает Редкость Легион-брони на 1 (R3 → R2), обычной — нет", () => {
    const base = realItem("armor", "armor", { availability: 3 });
    const legion = realItem("armor", "armor", { availability: 3, legion: true });
    expect(requisitionPlan(AW, { item: base }).rarity).toBe(3);
    const plan = requisitionPlan(AW, { item: legion });
    expect(plan.rarity).toBe(2);
    expect(plan.shifts.map(s => s.id)).toEqual(["requisition.ancientWarrior"]);
  });

  it("оружие со свойством Legion работает по-прежнему", () => {
    const w = { type: "weapon", name: "Болтер", system: { availability: 2, weaponProps: [{ key: "legion" }] } };
    expect(itemClass(w).legion).toBe(true);
    expect(requisitionPlan(AW, { item: w }).rarity).toBe(1);
  });

  it("выдача «Легион» стартового снаряжения помечает броню, а не только оружие", () => {
    const doc = { type: "armor", toObject: () => ({ type: "armor", system: { legion: false } }) };
    expect(gearObjects(doc, { legion: true })[0].system.legion).toBe(true);
    expect(gearObjects(doc, { legion: false })[0].system.legion).toBe(false);
  });
});
