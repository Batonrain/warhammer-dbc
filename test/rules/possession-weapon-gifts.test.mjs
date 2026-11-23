// Дары Одержимого для оружия: усилители на слитом оружии в Проявлении (Разобрать m9zer).
import { describe, it, expect } from "vitest";
import { possessionWeaponGiftProps, possessionWeaponGiftRules, possessionWeaponGiftDamage } from "../../module/rules/possession-weapon-gifts.mjs";

const actor = (manifested, fused = "w1",
  gifts = ["Fusion / Дар: Слияние", "Daemonic Venom / Дар: Демонический Яд", "Blades of the Soul / Дар: Лезвия Душ"]) => ({
  type: "character",
  flags: { "warhammer-dbc": { possessionFusedWeapon: fused } },
  system: { possessed: true, possession: { manifested }, corruptionBonus: 5 },
  items: gifts.map(name => ({ type: "talent", name }))
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

// Sahara 584-e-e-fl-2-dmg-pen: урон, Пробиваемость и тип урона слитого оружия.
describe("Дары-усилители: урон и тип урона", () => {
  const FUSION = "Fusion / Дар: Слияние";
  it("Молниевое Поле: +2 Dmg, +2 Pen, тип E без подвида", () => {
    const d = possessionWeaponGiftDamage(actor(true, "w1", [FUSION, "Lightning Field / Дар: Молниевое Поле"]), weapon);
    expect(d).toMatchObject({ dmg: 2, pen: 2, damageType: "energy", damageSubtype: "", halve: false });
    expect(d.note).toMatch(/Молниевое Поле/);
  });
  it("Варп-Пламя: тип E(Fl); с Молниевым Полем подвид Fl остаётся", () => {
    expect(possessionWeaponGiftDamage(actor(true, "w1", [FUSION, "Warpflame / Дар: Варп-Пламя"]), weapon))
      .toMatchObject({ dmg: 0, pen: 0, damageType: "energy", damageSubtype: "flame" });
    expect(possessionWeaponGiftDamage(actor(true, "w1",
      [FUSION, "Warpflame / Дар: Варп-Пламя", "Lightning Field / Дар: Молниевое Поле"]), weapon))
      .toMatchObject({ dmg: 2, pen: 2, damageType: "energy", damageSubtype: "flame" });
  });
  it("Лезвия Душ: урон до поглощения вдвое", () => {
    expect(possessionWeaponGiftDamage(actor(true), weapon).halve).toBe(true);
  });
  it("без Проявления, без Слияния или другим оружием — ничего", () => {
    const none = { dmg: 0, pen: 0, damageType: "", damageSubtype: "", halve: false, note: "" };
    expect(possessionWeaponGiftDamage(actor(false), weapon)).toEqual(none);
    expect(possessionWeaponGiftDamage(actor(true), { id: "w2" })).toEqual(none);
    expect(possessionWeaponGiftDamage(actor(true, "w1", ["Lightning Field / Дар: Молниевое Поле"]), weapon)).toEqual(none);
  });
});
