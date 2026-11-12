// test/rules/power-armour-size.test.mjs
//
// Силовая Броня (стр. 233, глава «СИЛОВАЯ БРОНЯ», wdbc-x1nz.4): «Увеличивает
// Размер персонажа до 1 (если он не больше изначально)». Потолок СНИЗУ, а не
// надбавка — персонаж Размером 2+ не уменьшается, Размером 0/−1 поднимается
// ровно до 1. Условие — armorType:"power" (НЕ Аспектная броня Аэльдари, та к
// этой главе не относится, см. rules/character.mjs про Вес), equipped:true,
// active !== false (разряженная/выключенная/отключённая Haywire батарея гасит
// бонус — см. rules/power-armour-battery.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { wearsActivePowerArmour } from "../../module/rules/predicates.mjs";

function characterWith({ items = [], ...patch } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 30; // Ag.b 3, без Размера SPD=3 → halfMove 3
  Object.assign(system, patch);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list,
                  getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

const powerArmour = (overrides = {}) => ({
  id: "armor-power-1", name: "Силовая Броня", type: "armor",
  system: { equipped: true, armorType: "power", active: true, ...overrides },
  getFlag: () => undefined
});

describe("wearsActivePowerArmour — предикат", () => {
  it("надета включённая силовая броня — true", () => {
    expect(wearsActivePowerArmour({ items: [powerArmour()] })).toBe(true);
  });

  it("броня не надета — false", () => {
    expect(wearsActivePowerArmour({ items: [powerArmour({ equipped: false })] })).toBe(false);
  });

  it("выключена (active:false) — false", () => {
    expect(wearsActivePowerArmour({ items: [powerArmour({ active: false })] })).toBe(false);
  });

  it("Аспектная броня (Аэльдари) — false, к главе «Силовая Броня» не относится", () => {
    expect(wearsActivePowerArmour({ items: [powerArmour({ armorType: "aspect" })] })).toBe(false);
  });

  it("обычная (flak) броня — false", () => {
    expect(wearsActivePowerArmour({ items: [powerArmour({ armorType: "flak" })] })).toBe(false);
  });

  it("нет active вовсе — по умолчанию включена, true", () => {
    const a = powerArmour();
    delete a.system.active;
    expect(wearsActivePowerArmour({ items: [a] })).toBe(true);
  });
});

describe("Силовая Броня поднимает Размер до 1", () => {
  it("Размер 0 (человек) в надетой включённой силовой броне → Размер 1, SPD считает с ним", () => {
    const system = characterWith({ items: [powerArmour()] });
    expect(system.sizeTotal).toBe(1);
    expect(system.movement.halfMove).toBe(4); // Ag.b 3 + Размер 1
  });

  it("без брони Размер остаётся 0", () => {
    const system = characterWith({});
    expect(system.sizeTotal).toBe(0);
    expect(system.movement.halfMove).toBe(3);
  });

  it("Размер уже выше 1 (напр. Астартес) — силовая броня его не уменьшает", () => {
    const system = characterWith({ items: [powerArmour()] });
    system.sizeMod = 2; // как если бы предзаполнил эффект «Размер (2)»
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([powerArmour()], { get: () => null }), getFlag: () => undefined
    });
    expect(system.sizeTotal).toBe(2);
    expect(system.movement.halfMove).toBe(5); // Ag.b 3 + Размер 2
  });

  it("броня снята (equipped:false) — Размер не поднимается", () => {
    const system = characterWith({ items: [powerArmour({ equipped: false })] });
    expect(system.sizeTotal).toBe(0);
  });

  it("броня выключена (active:false) — Размер не поднимается", () => {
    const system = characterWith({ items: [powerArmour({ active: false })] });
    expect(system.sizeTotal).toBe(0);
  });

  it("Аспектная броня (Аэльдари) Размер не поднимает", () => {
    const system = characterWith({ items: [powerArmour({ armorType: "aspect" })] });
    expect(system.sizeTotal).toBe(0);
  });

  it("sizeModNoSpd (Абсурдно Толстый) и пол Размера от брони складываются корректно", () => {
    const system = characterWith({ items: [powerArmour()] });
    system.sizeModNoSpd = 1;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([powerArmour()], { get: () => null }), getFlag: () => undefined
    });
    expect(system.sizeTotal).toBe(2); // пол 1 (броня) + 1 (sizeModNoSpd)
    expect(system.movement.halfMove).toBe(4); // Ag.b 3 + Размер(с полом) 1, sizeModNoSpd SPD не двигает
  });
});
