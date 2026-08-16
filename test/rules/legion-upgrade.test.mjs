// test/rules/legion-upgrade.test.mjs
//
// Легион-вариант оружия: пометил свойство Legion — профиль переделался под
// Астартес. У каждого рода оружия своя правка, и путать их нельзя: цепному
// Редкость двигают на +1, а примитивному — до 1, шоковому — до 2.

import { describe, it, expect } from "vitest";
import { legionUpgrade, legionKind, addFlatDamage } from "../../module/rules/legion-upgrade.mjs";

const weapon = (patch = {}) => ({
  weaponClass: "melee", weaponType: "chain", damage: "1d10+3", penetration: 2,
  weight: 5, availability: 1, weaponProps: [], ...patch
});

describe("addFlatDamage", () => {
  it("двигает хвостовую константу, а кубик не трогает", () => {
    expect(addFlatDamage("1d10+3", 1)).toBe("1d10+4");
    expect(addFlatDamage("2d10", 1)).toBe("2d10+1");
    expect(addFlatDamage("1d10+3", -1)).toBe("1d10+2");
  });

  it("обнулившаяся прибавка исчезает, а не пишется «+0»", () => {
    expect(addFlatDamage("1d10+1", -1)).toBe("1d10");
  });

  it("формулу с характеристикой не портит", () => {
    expect(addFlatDamage("1d10+S.b", 1)).toBe("1d10+S.b+1");
  });
});

describe("legionKind", () => {
  it("щит узнаётся по свойству, а не по типу", () => {
    expect(legionKind(weapon({ weaponType: "lowtech", weaponProps: [{ key: "defensive" }] }))).toBe("shield");
  });

  it("примитивным считается и по типу, и по свойству", () => {
    expect(legionKind(weapon({ weaponType: "primitive" }))).toBe("primitive");
    expect(legionKind(weapon({ weaponType: "lowtech", weaponProps: ["primitive"] }))).toBe("primitive");
  });

  it("низкотехнологичное и экзотика Легион-варианта не имеют", () => {
    expect(legionKind(weapon({ weaponType: "lowtech" }))).toBe("");
    expect(legionKind(weapon({ weaponType: "exotic" }))).toBe("");
    expect(legionUpgrade(weapon({ weaponType: "exotic" }))).toBeNull();
  });
});

describe("legionUpgrade", () => {
  it("цепное: Редкость +1, вес вдвое, Dmg +1, Pen +1", () => {
    const { changes } = legionUpgrade(weapon({ weaponType: "chain" }));
    expect(changes).toEqual({ weight: 10, damage: "1d10+4", penetration: 3, availability: 2 });
  });

  it("силовое считается так же, как цепное", () => {
    const { changes } = legionUpgrade(weapon({ weaponType: "power", availability: 3 }));
    expect(changes.availability).toBe(4);
  });

  it("примитивное поднимает Редкость до 1, а уже дотянувшую двигает на +1", () => {
    expect(legionUpgrade(weapon({ weaponType: "primitive", availability: 0 })).changes.availability).toBe(1);
    expect(legionUpgrade(weapon({ weaponType: "primitive", availability: 2 })).changes.availability).toBe(3);
  });

  it("шоковое поднимает Редкость до 2", () => {
    expect(legionUpgrade(weapon({ weaponType: "shock", availability: 0 })).changes.availability).toBe(2);
    expect(legionUpgrade(weapon({ weaponType: "shock", availability: 3 })).changes.availability).toBe(4);
  });

  it("психосиловое только тяжелеет втрое", () => {
    const { changes } = legionUpgrade(weapon({ weaponType: "psychic", weight: 4 }));
    expect(changes).toEqual({ weight: 12 });
  });

  it("примитивному и щиту приписывается то, чего нет в числах", () => {
    expect(legionUpgrade(weapon({ weaponType: "primitive" })).note).toMatch(/Hardened и Mono/);
    const shield = legionUpgrade(weapon({ weaponProps: [{ key: "defensive" }] }));
    expect(shield.note).toMatch(/\+1 AP/);
    expect(shield.changes.penetration).toBe(3);
  });
});
