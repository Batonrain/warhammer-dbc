// test/combat/armor-agility-cap.test.mjs
//
// Потолок Ловкости (корбук, Max Agility): тяжёлая броня ограничивает Ловкость
// сверху — терминаторский Сатурнин 25, Катафракт 35, Индомитус 45. Обычная
// броня потолка не ставит, и в данных у неё стоит 100.
//
// Модификации потолок поднимают: «Открытые Сочленения» дают +10 своей броне.
// Считается это по той же дорожке, что и AP модификаций (getArmorModEffects),
// поэтому мод в рюкзаке, на снятой броне или выключенный потолок не двигает.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { armorAgilityCap } from "../../module/combat/armor-mods.mjs";

/** Актор с предметами: модификации ищут носителя через actor.items. */
function actorWith(...items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { items: list, system: {} };
}

const armor = (id, maxAgility, equipped = true) =>
  ({ id, type: "armor", system: { equipped, armorType: "power", maxAgility } });

const mod = (id, installedOn, maxAgilityMod) => ({
  id, type: "armorMod", name: "Открытые Сочленения",
  system: { installedOn, category: "armor", effects: { maxAgilityMod } },
  getFlag: () => undefined
});

describe("потолок Ловкости от брони", () => {
  it("без брони потолка нет", () => {
    expect(armorAgilityCap(actorWith())).toBe(null);
  });

  it("обычная броня оставляет потолок в 100", () => {
    expect(armorAgilityCap(actorWith(armor("a1", 100)))).toBe(100);
  });

  it("терминаторский доспех ставит свой потолок", () => {
    expect(armorAgilityCap(actorWith(armor("a1", 25)))).toBe(25);
  });

  it("Открытые Сочленения поднимают потолок своей брони", () => {
    expect(armorAgilityCap(actorWith(armor("a1", 25), mod("m1", "a1", 10)))).toBe(35);
  });

  it("из нескольких надетых действует самый строгий", () => {
    expect(armorAgilityCap(actorWith(armor("a1", 25), armor("a2", 100)))).toBe(25);
  });

  it("модификация чужой брони потолок не двигает", () => {
    expect(armorAgilityCap(actorWith(armor("a1", 25), armor("a2", 100), mod("m1", "a2", 10)))).toBe(25);
  });

  it("снятая броня потолка не ставит", () => {
    expect(armorAgilityCap(actorWith(armor("a1", 25, false)))).toBe(null);
  });

  it("броня без поля считается беспотолочной сотней", () => {
    const bare = { id: "a1", type: "armor", system: { equipped: true } };
    expect(armorAgilityCap(actorWith(bare))).toBe(100);
  });
});
