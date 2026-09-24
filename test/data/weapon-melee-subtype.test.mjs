// test/data/weapon-melee-subtype.test.mjs
//
// Приёмка #516: ни у одного Меча в паках нет meleeSubtype, а от него зависят
// правила Рапиры/Сабли (Выпад/Взмах, игнор +1 Rng, вторая атака Сабли).
// Подтип выводится из имени, если не проставлен руками.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { WeaponData } from "../../module/data/item/weapon.mjs";

function derived(name, system) {
  const sys = { meleeCategory: "Меч", meleeSubtype: "", ...system, parent: { name } };
  WeaponData.prototype.prepareBaseData.call(sys);
  return sys.meleeSubtype;
}

describe("WeaponData: подтип Меча из имени", () => {
  it("Сабля/Рапира по имени", () => {
    expect(derived("Saber / Сабля")).toBe("Сабля");
    expect(derived("Voidsabre / Пустотная Сабля")).toBe("Сабля");
    expect(derived("Force Rapier / Психосиловая Рапира")).toBe("Рапира");
  });
  it("не Меч, прочий Меч и ручной выбор — не трогаются", () => {
    expect(derived("Rapier Laser Array / Лазерный Комплекс Рапира", { meleeCategory: "" })).toBe("");
    expect(derived("Chainsword / Цепной Меч")).toBe("");
    expect(derived("Saber / Сабля", { meleeSubtype: "Рапира" })).toBe("Рапира");
  });
});
