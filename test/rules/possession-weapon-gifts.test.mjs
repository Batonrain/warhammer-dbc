// Дары Одержимого для оружия: усилители на слитом оружии в Проявлении (Разобрать m9zer).
import { describe, it, expect } from "vitest";
import { possessionWeaponGiftProps, possessionWeaponGiftRules } from "../../module/rules/possession-weapon-gifts.mjs";

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
