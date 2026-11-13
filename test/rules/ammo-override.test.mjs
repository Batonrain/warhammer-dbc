// test/rules/ammo-override.test.mjs
//
// Снаряды орудий техники (wdbc-nzzgn): у машины ровно одно «главное орудие»,
// а книга даёт на него список снарядов, каждый со СВОИМИ Dmg/Pen/Rng. Боеприпас
// персонажа лишь правит профиль оружия (+N), здесь же он ЗАМЕНЯЕТ его:
// damageOverride / penetrationOverride / rangeOverride — абсолютные числа.
// И подбор: снаряд с weaponTag подходит только орудию с тем же именем
// (иначе «Phosphex Shell» предлагался бы любой Боевой Пушке).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { ammoFitsWeapon, ammoOverrides, effectiveAmmoRange, weaponAmmoTagOf, shellDroppedProps }
  from "../../module/rules/ammo-override.mjs";

const gun = (name, over = {}) => ({ name, system: { weaponType: "solid", weaponClass: "heavy", ...over } });
const shell = (system = {}) => ({ type: "ammo", system: { weaponTypes: ["any"], weaponTag: "", ...system } });

describe("weaponAmmoTagOf — имя орудия как тег", () => {
  it("берёт английскую часть «Английское / Русское»", () => {
    expect(weaponAmmoTagOf({ name: "Medusa Siege Cannon / Осадная Пушка Медуза" })).toBe("medusa siege cannon");
  });
  it("имя без русской части берётся целиком, регистр не важен", () => {
    expect(weaponAmmoTagOf({ name: "  Battle CANNON " })).toBe("battle cannon");
  });
  it("пустое имя — пустой тег", () => {
    expect(weaponAmmoTagOf({})).toBe("");
  });
});

describe("ammoFitsWeapon — подбор снаряда", () => {
  it("без weaponTag работает старое правило по типу оружия", () => {
    expect(ammoFitsWeapon(shell({ weaponTypes: ["solid"] }), gun("X"))).toBe(true);
    expect(ammoFitsWeapon(shell({ weaponTypes: ["laser"] }), gun("X"))).toBe(false);
    expect(ammoFitsWeapon(shell({ weaponTypes: ["heavy"] }), gun("X"))).toBe(true);
    expect(ammoFitsWeapon(shell({ weaponTypes: ["any"] }), gun("X"))).toBe(true);
  });
  it("с weaponTag подходит только орудию с тем же именем", () => {
    const s = shell({ weaponTag: "Medusa Siege Cannon" });
    expect(ammoFitsWeapon(s, gun("Medusa Siege Cannon / Осадная Пушка Медуза"))).toBe(true);
    expect(ammoFitsWeapon(s, gun("Battle Cannon / Боевая Пушка"))).toBe(false);
  });
  it("тег не заменяет проверку типа: чужой тип оружия не берётся", () => {
    const s = shell({ weaponTypes: ["laser"], weaponTag: "Battle Cannon" });
    expect(ammoFitsWeapon(s, gun("Battle Cannon"))).toBe(false);
  });
  it("не-боеприпас никогда не подходит", () => {
    expect(ammoFitsWeapon({ type: "gear", system: { weaponTypes: ["any"] } }, gun("X"))).toBe(false);
  });
  it("sysOverride (ствол комби-оружия) определяет тип, но не имя", () => {
    const s = shell({ weaponTypes: ["bolt"] });
    expect(ammoFitsWeapon(s, gun("Combi"), { weaponType: "bolt" })).toBe(true);
  });
});

describe("ammoOverrides — абсолютные значения вместо базы орудия", () => {
  it("пустой боеприпас/без полей — ничего не заменяет", () => {
    expect(ammoOverrides(null)).toEqual({ damage: null, penetration: null, range: null });
    expect(ammoOverrides({})).toEqual({ damage: null, penetration: null, range: null });
    expect(ammoOverrides({ damageOverride: "", penetrationOverride: null, rangeOverride: 0 }))
      .toEqual({ damage: null, penetration: null, range: null });
  });
  it("заданные поля заменяют", () => {
    expect(ammoOverrides({ damageOverride: "6d10+12", penetrationOverride: 21, rangeOverride: 100 }))
      .toEqual({ damage: "6d10+12", penetration: 21, range: 100 });
  });
  it("Пробитие 0 — настоящее значение, а не «не задано»", () => {
    expect(ammoOverrides({ penetrationOverride: 0 }).penetration).toBe(0);
  });
  it("«–» и «0» в уроне значат «снаряд без урона» (дым, осветительный)", () => {
    expect(ammoOverrides({ damageOverride: "–" }).damage).toBe("");
    expect(ammoOverrides({ damageOverride: "0" }).damage).toBe("");
  });
});

describe("effectiveAmmoRange", () => {
  it("rangeOverride заменяет, множитель и прибавка при этом не применяются", () => {
    expect(effectiveAmmoRange(1200, { rangeOverride: 100, rangeMultiplier: 2, rangeMod: 50 })).toBe(100);
  });
  it("без override — как раньше: база × множитель + прибавка", () => {
    expect(effectiveAmmoRange(1200, { rangeMultiplier: 1.5, rangeMod: 10 })).toBe(1810);
    expect(effectiveAmmoRange(1200, undefined)).toBe(1200);
  });
});

describe("shellDroppedProps — снаряд заменяет профиль целиком", () => {
  const base = [{ key: "concussive", rating: 3 }, { key: "blast", rating: 8 }, { key: "ordnance" }];
  it("убирает свойства базы, которых нет у снаряда; свои оставляет", () => {
    const smoke = { weaponTag: "Battle Cannon", properties: [{ key: "ordnance" }, { key: "smoke", rating: 15 }] };
    expect(shellDroppedProps(smoke, base).sort()).toEqual(["blast", "concussive"]);
  });
  it("обычный боеприпас (без тега) ничего не снимает", () => {
    expect(shellDroppedProps({ weaponTag: "", properties: [] }, base)).toEqual([]);
    expect(shellDroppedProps(undefined, base)).toEqual([]);
  });
  it("строковые свойства в базе тоже понимает", () => {
    expect(shellDroppedProps({ weaponTag: "X", properties: [] }, ["blast"])).toEqual(["blast"]);
  });
});
