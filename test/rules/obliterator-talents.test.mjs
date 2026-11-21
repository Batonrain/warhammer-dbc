// Облитератор: Живой Арсенал, Расчленитель, До Зубов, Измельчитель (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  assimilable, livingArsenalWeapon, livingArsenalAmmoFree, livingArsenalOneHand,
  isShoulderWeapon, shoulderSlotsLeft, shredderHordeHits, mutilatorRules
} from "../../module/rules/obliterator-talents.mjs";
import { boonString } from "../../module/rules/astartes-elite-common.mjs";

const NS = "warhammer-dbc";
const trait = { type: "trait", name: "Living Arsenal / Живой Арсенал" };
const w = (cls, flags = {}, sys = {}) => ({ type: "weapon", name: "Gun", system: { weaponClass: cls, ...sys }, flags: { [NS]: flags } });

describe("Живой Арсенал", () => {
  it("что можно ассимилировать", () => {
    expect(assimilable(w("basic"))).toBe(true);
    expect(assimilable(w("thrown"))).toBe(false);
    expect(assimilable(w("heavy", {}, { weaponType: "launcher" }))).toBe(false);
    expect(assimilable(w("melee", {}, { daemonWeapon: { bound: true } }))).toBe(false);
    expect(assimilable({ ...w("melee"), name: "Force Sword / Психосиловой Меч" })).toBe(false);
  });
  it("только помеченное оружие у носителя Черты", () => {
    const a = { items: [trait] };
    const gun = w("heavy", { livingArsenal: true });
    expect(livingArsenalWeapon(a, gun)).toBe(true);
    expect(livingArsenalWeapon({ items: [] }, gun)).toBe(false);
    expect(livingArsenalWeapon(a, w("heavy"))).toBe(false);
    expect(livingArsenalOneHand(a, gun)).toBe(true);
    expect(livingArsenalOneHand(a, w("pistol", { livingArsenal: true }))).toBe(false);
  });
  it("стандартный боеприпас бесплатно, спецбоеприпас — нет", () => {
    const a = { items: [trait] };
    expect(livingArsenalAmmoFree(a, w("basic", { livingArsenal: true }))).toBe(true);
    expect(livingArsenalAmmoFree(a, w("basic", { livingArsenal: true }, { loadedAmmoId: "x" }))).toBe(false);
  });
});

describe("До Зубов и Измельчитель", () => {
  it("наплечное живо до конца боя, не больше двух", () => {
    const g = w("basic", { toTheTeeth: boonString({ combatId: "c1", sceneId: "s1" }) });
    expect(isShoulderWeapon(g, { combatId: "c1" })).toBe(true);
    expect(isShoulderWeapon(g, { combatId: "c2" })).toBe(false);
    expect(shoulderSlotsLeft({ items: [g, g] }, { combatId: "c1" })).toBe(0);
    expect(shoulderSlotsLeft({ items: [g] }, { combatId: "c2" })).toBe(2);
  });
  it("Орда: 1 попадание за полные 5 Магнитуды, не больше 6", () => {
    expect(shredderHordeHits(4)).toBe(0);
    expect(shredderHordeHits(14)).toBe(2);
    expect(shredderHordeHits(100)).toBe(6);
  });
});

describe("Расчленитель", () => {
  it("включён — Помеха на BS, лучший из двух на WS", () => {
    const on = { items: [{ type: "talent", name: "Mutilator / Расчленитель", flags: { [NS]: { activated: { combatId: "", at: 0 } } } }] };
    const rules = mutilatorRules(on);
    expect(rules[0].effects[0]).toMatchObject({ mode: "keepWorst", target: ["weapon:ranged", "char:bs"] });
    expect(rules[1].effects[0]).toMatchObject({ mode: "keepBest", target: ["weapon:melee", "char:ws"] });
    expect(mutilatorRules({ items: [{ type: "talent", name: "Mutilator" }] })).toEqual([]);
  });
});
