// test/documents/beyond-human-char-bonus.test.mjs
//
// За Гранью Человека (стр. 62): «Трейт Unnatural Characteristic (+1)» —
// расчёт листа (module/rules/character.mjs) прибавляет +1 к Бонусу той
// Характеристики, к которой Талант привязан при покупке (aptSource).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const talent = (id, aptSource, name = "Beyond Human / За Гранью Человека") => ({
  id, name, type: "talent",
  system: { aptSource, specialization: "", effects: {} },
  getFlag: () => undefined, effects: []
});

function characterWith(items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.s.base = 70;
  system.characteristics.t.base = 70;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", uuid: "Actor.bh1", name: "Подставной",
                  system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("За Гранью Человека на листе", () => {
  it("без Таланта Бонус — обычный ⌊70/10⌋", () => {
    const sys = characterWith();
    expect(sys.characteristics.s.bonus).toBe(7);
    expect(sys.traitCharBonus.s ?? 0).toBe(0);
  });

  it("с Талантом на S: Бонус S растёт на 1, Бонус T — нет", () => {
    const sys = characterWith([talent("bh1", "s")]);
    expect(sys.characteristics.s.bonus).toBe(8);
    expect(sys.characteristics.t.bonus).toBe(7);
    expect(sys.traitCharBonus.s).toBe(1);
  });

  it("две копии на одну Характеристику дают всё то же +1", () => {
    const sys = characterWith([talent("bh1", "s"), talent("bh2", "s")]);
    expect(sys.characteristics.s.bonus).toBe(8);
  });

  it("Мастерство и другие Таланты Бонус не трогают", () => {
    const sys = characterWith([talent("m1", "s", "Mastery / Мастерство")]);
    expect(sys.characteristics.s.bonus).toBe(7);
  });

  it("без привязки Талант ничего не даёт", () => {
    const sys = characterWith([talent("bh1", "")]);
    expect(sys.characteristics.s.bonus).toBe(7);
  });
});
