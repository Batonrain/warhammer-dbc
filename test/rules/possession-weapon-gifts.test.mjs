// Дары Одержимого для оружия: усилители на слитом оружии в Проявлении (Разобрать m9zer).
import { describe, it, expect } from "vitest";
import { possessionWeaponGiftProps, possessionWeaponGiftRules, possessionWeaponGiftStats, halveSoulBladeDamage } from "../../module/rules/possession-weapon-gifts.mjs";

const actor = (manifested, fused = "w1") => ({
  type: "character",
  flags: { "warhammer-dbc": { possessionFusedWeapon: fused } },
  system: { possessed: true, possession: { manifested }, corruptionBonus: 5 },
  items: ["Fusion / Дар: Слияние", "Daemonic Venom / Дар: Демонический Яд", "Blades of the Soul / Дар: Лезвия Душ"]
    .map(name => ({ type: "talent", name }))
});
const weapon = { id: "w1", system: { weaponClass: "melee" } };

describe("Дары-усилители", () => {
  it("в Проявлении слитое оружие получает свойства", () => {
    const keys = possessionWeaponGiftProps(actor(true), weapon).map(p => `${p.key}${p.rating ? `(${p.rating})` : ""}`);
    expect(keys).toEqual(["reinforced", "felling(3)", "toxic(3)", "warpWeapon"]);
  });
  it("другое оружие и без Проявления — ничего", () => {
    expect(possessionWeaponGiftProps(actor(true), { id: "w2" })).toEqual([]);
    expect(possessionWeaponGiftProps(actor(false), weapon)).toEqual([]);
  });
  it("правила — grantWeaponProp на атаку", () => {
    const rules = possessionWeaponGiftRules(actor(true), { weapon });
    expect(rules.every(r => r.effects[0].kind === "grantWeaponProp" && r.effects[0].target === "attack")).toBe(true);
  });
});

// Studio 579-175: числа Даров-усилителей, которых нет в реестре свойств.
const withGifts = (names, manifested = true) => ({
  ...actor(manifested),
  items: ["Fusion / Дар: Слияние", ...names].map(name => ({ type: "talent", name }))
});

describe("Дары-усилители: урон, Pen и тип урона", () => {
  it("Молниевое Поле — +2 Dmg, +2 Pen, урон E", () => {
    const s = possessionWeaponGiftStats(withGifts(["Lightning Field / Дар: Молниевое Поле"]), weapon);
    expect([s.dmg, s.pen, s.damageType, s.damageSubtype, s.halve]).toEqual([2, 2, "energy", "", false]);
  });
  it("Варп-Пламя — E(Fl); вместе с Молниевым Полем подвид остаётся E(Fl)", () => {
    expect(possessionWeaponGiftStats(withGifts(["Warpflame / Дар: Варп-Пламя"]), weapon))
      .toMatchObject({ dmg: 0, pen: 0, damageType: "energy", damageSubtype: "flame" });
    expect(possessionWeaponGiftStats(withGifts(["Lightning Field / Дар: Молниевое Поле", "Warpflame / Дар: Варп-Пламя"]), weapon))
      .toMatchObject({ dmg: 2, pen: 2, damageType: "energy", damageSubtype: "flame" });
  });
  it("Лезвия Душ — урон попадания вдвое, окр. вверх", () => {
    const s = possessionWeaponGiftStats(withGifts(["Blades of the Soul / Дар: Лезвия Душ"]), weapon);
    expect(s.halve).toBe(true);
    expect(halveSoulBladeDamage(15, s.halve)).toBe(8);
    expect(halveSoulBladeDamage(15, false)).toBe(15);
  });
  it("без Проявления, без Слияния или другим оружием — нули", () => {
    const zero = { dmg: 0, pen: 0, damageType: "", damageSubtype: "", halve: false };
    expect(possessionWeaponGiftStats(withGifts(["Lightning Field / Дар: Молниевое Поле"], false), weapon)).toMatchObject(zero);
    expect(possessionWeaponGiftStats(withGifts(["Lightning Field / Дар: Молниевое Поле"]), { id: "w2" })).toMatchObject(zero);
    const noFusion = { ...actor(true), items: [{ type: "talent", name: "Lightning Field / Дар: Молниевое Поле" }] };
    expect(possessionWeaponGiftStats(noFusion, weapon)).toMatchObject(zero);
  });
});
