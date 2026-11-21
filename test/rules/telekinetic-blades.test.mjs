// test/rules/telekinetic-blades.test.mjs
//
// wdbc-1rno.28 / Sahara 578-628b: общий механизм призванного оружия и Клинки Силы.
// Книга (core.json, «Клинки силы»): Telekinetic Blade — стандартное примитивное
// рукопашное, только профили R, +PR Dmg, +PR Pen, невесомо, −20 к Избеганиям
// незасекшего, с Точным Телекинезом — Незримое; ещё клинок на PR 4+/7+/10+.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  telekineticBladeCount, telekineticBladeWeaponData, isTelekineticBladeCandidate,
  telekineticEdgeBuff, sustainsPrecisionTelekinesis, precisionTelekinesisArms, TK_BLADE_KIND
} from "../../module/rules/telekinetic-blades.mjs";
import {
  summonedBy, isSummonedItem, isPsychicSummon, summonsOf, dissolvesOnChange, orphanedSummons
} from "../../module/rules/summoned-weapon.mjs";
import { DAEMONIC_ARMAMENT_FLAG } from "../../module/rules/daemonic-armament.mjs";
import { baseHandsFromTraits } from "../../module/rules/hands.mjs";
import { aggregateAuto, resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";

const read = f => JSON.parse(fs.readFileSync(path.resolve(f), "utf8"));
const sword = read("packs-src/weapons/Имперское/Рукопашное/Примитивное/Sword___Меч_xt9bG5qJ2JLarOXG.json");
const club = read("packs-src/weapons/Имперское/Рукопашное/Примитивное/Club___Дубинка_iYetscOhjmfXcaPF.json");
const IMP = ["Имперское", "Рукопашное", "Примитивное"];
const power = (name, sustained, id = "p1") => ({ id, type: "psychicPower", name, system: { isSustained: sustained } });

describe("сколько клинков", () => {
  it("1 / 2 на PR 4 / 3 на PR 7 / 4 на PR 10", () => {
    expect([1, 3, 4, 6, 7, 9, 10, 12].map(telekineticBladeCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("образец", () => {
  it("Меч из имперского примитивного — годится", () =>
    expect(isTelekineticBladeCandidate({ type: "weapon", system: sword.system, folderPath: IMP })).toBe(true));
  it("Дубинка (I) — нет: только профили R", () =>
    expect(isTelekineticBladeCandidate({ type: "weapon", system: club.system, folderPath: IMP })).toBe(false));
  it("чужой арсенал (не Имперское) — нет", () =>
    expect(isTelekineticBladeCandidate({ type: "weapon", system: sword.system, folderPath: ["Друкхари", "Рукопашное", "Примитивное"] })).toBe(false));
});

describe("клинок на образце Меча, эPR 5", () => {
  const data = telekineticBladeWeaponData(sword, { epr: 5, powerId: "p1" });
  it("+5 Dmg, +5 Pen, невесомо, в руке", () => {
    expect(data.system.damage).toBe("1d10+5");
    expect(data.system.penetration).toBe((Number(sword.system.penetration) || 0) + 5);
    expect(data.system.weight).toBe(0);
    expect(data.system.equipped).toBe(true);
  });
  it("Невидимое (−20) в свойствах и метка психического призыва", () => {
    expect(data.system.weaponProps.map(p => p.key)).toContain("unseenPartial");
    const item = { type: "weapon", flags: data.flags };
    expect(summonedBy(item)).toEqual({ sourceId: "p1", kind: TK_BLADE_KIND, psychic: true });
    expect(isPsychicSummon(item)).toBe(true);
  });
  it("свойство даёт флаг боя unseenPartial", () => {
    expect(aggregateAuto(resolveWeaponPropsList(data.system.weaponProps)).unseenPartial).toBe(true);
  });
});

describe("Телекинетическое Лезвие", () => {
  it("R-оружие: +PR Dmg, +PR Pen, Reinforced, на конкретное оружие", () => {
    expect(telekineticEdgeBuff({ id: "w1", system: { damageType: "rending" } }, 4))
      .toMatchObject({ enabled: true, weaponId: "w1", damageMod: 4, penMod: 4, addProps: [{ key: "reinforced" }] });
  });
  it("I-оружие: Pen не растёт", () =>
    expect(telekineticEdgeBuff({ id: "w2", system: { damageType: "impact" } }, 4).penMod).toBe(0));
});

describe("Точный Телекинез", () => {
  it("руки +2 только пока поддерживается", () => {
    const on = { items: [power("Precision Telekinesis / Точный Телекинез", true)], system: {} };
    const off = { items: [power("Precision Telekinesis / Точный Телекинез", false)], system: {} };
    expect(sustainsPrecisionTelekinesis(on)).toBe(true);
    expect(precisionTelekinesisArms(off)).toBe(0);
    expect(baseHandsFromTraits(on)).toBe(baseHandsFromTraits(off) + 2);
  });
});

describe("призванное оружие — общий механизм", () => {
  const blade = { id: "b1", type: "weapon", flags: { "warhammer-dbc": { summonedBy: { sourceId: "p1", kind: "telekineticBlade", psychic: true } } } };
  const da = { id: "d1", type: "weapon", flags: { "warhammer-dbc": { [DAEMONIC_ARMAMENT_FLAG]: { traitId: "t" } } } };
  it("Демоническое Вооружение — тоже призванное (одно растворение на всех)", () => {
    expect(isSummonedItem(da)).toBe(true);
    expect(dissolvesOnChange(da, { system: { equipped: false } })).toBe(true);
    expect(dissolvesOnChange(blade, { system: { stored: true } })).toBe(true);
    expect(dissolvesOnChange(blade, { system: { damage: "1d10" } })).toBe(false);
  });
  it("сила поддерживается — клинок живёт; снята — растворяется; силы нет — тоже", () => {
    const sustained = { items: [power("Telekinetic Blade", true), blade, da] };
    expect(summonsOf(sustained, "p1")).toEqual([blade]);
    expect(orphanedSummons(sustained)).toEqual([]);
    expect(orphanedSummons({ items: [power("Telekinetic Blade", false), blade, da] })).toEqual([blade]);
    expect(orphanedSummons({ items: [blade, da] })).toEqual([blade]);
  });
});
