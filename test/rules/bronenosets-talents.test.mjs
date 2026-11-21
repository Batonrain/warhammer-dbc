// Броненосец: Великий Лук Хаоса, Избранное Пламя, Латы Чародея, Пожиратель Греха,
// Дикобраз, Могущество (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  bronenosetsWeaponBonus, sorcerersPlateDeg, sinEaterNext, hedgehogCrippling,
  potenceGripActive, potenceBalance, isBowWeapon, torsoAP
} from "../../module/rules/bronenosets-talents.mjs";

const talent = (name, flags = {}) => ({ type: "talent", name, flags });
const champ = (items, extra = {}) => ({
  items, system: { corruptionBonus: 5, characteristics: { s: { bonus: 6 } }, absorption: { body: 17, toughnessBonus: 8 }, ...extra }
});
const bow = (flag = false) => ({ type: "weapon", name: "Greatbow / Великий Лук", system: { weaponClass: "basic" },
  flags: flag ? { "warhammer-dbc": { chaosGreatbow: true } } : {} });
const sword = { type: "weapon", name: "Sword / Меч", system: { weaponClass: "melee", grips: "1р" } };
const greatsword = { type: "weapon", name: "Greatsword", system: { weaponClass: "melee", grips: "2р" } };

describe("Великий Лук Хаоса", () => {
  it("преображённый лук: +S.b +½Cor.b к урону, +½Cor.b Pen, без Primitive", () => {
    const a = champ([talent("Chaos Greatbow / Великий Лук Хаоса")]);
    expect(bronenosetsWeaponBonus(a, bow(true), { isMelee: false })).toMatchObject({ dmg: 9, pen: 3, losesPrimitive: true });
  });
  it("без метки на луке или без Таланта — ничего", () => {
    expect(bronenosetsWeaponBonus(champ([talent("Chaos Greatbow")]), bow(false)).dmg).toBe(0);
    expect(bronenosetsWeaponBonus(champ([]), bow(true)).dmg).toBe(0);
  });
  it("лук опознаётся по имени, меч — нет", () => {
    expect(isBowWeapon(bow())).toBe(true);
    expect(isBowWeapon(sword)).toBe(false);
  });
});

describe("Избранное Пламя", () => {
  it("включено — рукопашное +½Cor.b к Dmg и Pen", () => {
    const a = champ([talent("Chosen Flame / Избранное Пламя", { "warhammer-dbc": { activated: { combatId: "", at: 0 } } })]);
    expect(bronenosetsWeaponBonus(a, sword, { isMelee: true })).toMatchObject({ dmg: 3, pen: 3, losesPrimitive: true });
    expect(bronenosetsWeaponBonus(a, bow(), { isMelee: false }).dmg).toBe(0);
  });
  it("не включено — ничего", () => {
    expect(bronenosetsWeaponBonus(champ([talent("Chosen Flame")]), sword, { isMelee: true }).dmg).toBe(0);
  });
});

describe("Латы Чародея", () => {
  const a = champ([talent("Sorcerer's Plate / Латы Чародея")]);
  it("AP торса без T.b", () => expect(torsoAP(a)).toBe(9));
  it("успешный W против психосилы: +½ AP торса (окр.▲)", () => {
    expect(sorcerersPlateDeg(a, { success: true, ctx: { psychicThreat: true }, charKey: "wp" })).toBe(5);
  });
  it("провал, не психосила или не W — ноль", () => {
    expect(sorcerersPlateDeg(a, { success: false, ctx: { psychicThreat: true }, charKey: "wp" })).toBe(0);
    expect(sorcerersPlateDeg(a, { success: true, ctx: {}, charKey: "wp" })).toBe(0);
    expect(sorcerersPlateDeg(a, { success: true, ctx: { psychicThreat: true }, charKey: "t" })).toBe(0);
  });
});

describe("Пожиратель Греха", () => {
  it("Cor чемпиона выше рейтинга ×10 — +1", () => {
    expect(sinEaterNext(0, 1)).toBe(1);
    expect(sinEaterNext(3, 31)).toBe(4);
  });
  it("не выше — рейтинг прежний", () => expect(sinEaterNext(3, 30)).toBe(3));
});

describe("Дикобраз и Могущество", () => {
  it("Калечащее шипов = ½Cor.b", () => {
    expect(hedgehogCrippling(champ([talent("Hedgehog / Дикобраз")]))).toBe(3);
    expect(hedgehogCrippling(champ([]))).toBe(0);
  });
  it("Могущество: «1р» только у двуручного рукопашного, Баланс −2", () => {
    const a = champ([talent("Potence / Могущество")]);
    expect(potenceGripActive(a, greatsword)).toBe(true);
    expect(potenceGripActive(a, sword)).toBe(false);
    expect(potenceBalance(a, greatsword, "1р")).toBe(-2);
    expect(potenceBalance(a, greatsword, "2р")).toBe(null);
    expect(potenceGripActive(champ([]), greatsword)).toBe(false);
  });
});
