// test/rules/power-armour-strength-bonus.test.mjs
//
// Выключенная силовая броня (книга, «Силовая Броня», стр. 233): «не дает три
// предыдущих бонуса» — бонус S, нейтрализация веса, ретинальный дисплей.
// Нейтрализация веса уже проверяла active (documents/actor.mjs), а бонус S/WP
// начислялся всегда, пока броня надета, даже выключенной (wdbc-x1nz.4). Тест
// гоняет настоящий prepareCharacterDerived через prepareDerivedData актора —
// тот же приём, что test/rules/character-gravity.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function derivedWith(active) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  const armour = {
    id: "pa1", type: "armor", name: "Силовая броня",
    system: { equipped: true, armorType: "power", active, strengthBonus: 20, wpBonus: 0 },
    getFlag: () => undefined
  };
  const list = [armour];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Бонус S силовой брони гасится, пока она выключена (wdbc-x1nz.4)", () => {
  it("включённая броня даёт +20 к S", () => {
    const on  = derivedWith(true);
    const off = derivedWith(false);
    expect(on.characteristics.s.total - off.characteristics.s.total).toBe(20);
  });

  it("выключенная броня не даёт бонус S вовсе", () => {
    const off = derivedWith(false);
    expect(off.armorCharBonus.s).toBe(0);
  });

  it("включённая броня действительно даёт бонус S в armorCharBonus", () => {
    const on = derivedWith(true);
    expect(on.armorCharBonus.s).toBe(20);
  });
});
