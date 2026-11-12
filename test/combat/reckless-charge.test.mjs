// test/combat/reckless-charge.test.mjs
//
// Reckless Charge / Безрассудный Натиск (Талант Берсерка, Sahara 3-861e): «Проводя Натиск, персонаж может
// скомбинировать его с Полной Атакой, получив все бонусы и штрафы последней вместо бонусов Натиска.
// Считается одновременно Натиском и Полной Атакой.» База recklessCharge двойная: везде, где код спрашивал
// «Натиск?» или «Полная Атака?», она отвечает «да» на оба (rules/melee-base.mjs).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { buildSelection } from "../../module/sheets/attack/selection.mjs";
import { MELEE_BASES, MELEE_MANEUVERS, MELEE_CONTESTS } from "../../module/constants/combat.mjs";
import { baseAspects, baseIsCharge, baseIsFullAttack, baseFitsList } from "../../module/rules/melee-base.mjs";
import {
  berserkChargeBonus, meleeBaseBonus, hammerBlowEffect, killingStrikeApplies, furiousAssaultOffered,
  overpowerOffered
} from "../../module/rules/berserker-talents.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";

const RECKLESS = "berserker.core.recklessCharge";
const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const named = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const holder = (extra = []) => ({ system: { characteristics: {} }, items: extra });

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("составная База: обе части", () => {
  it("состав и вопросы «Натиск?» / «Полная Атака?»", () => {
    expect(baseAspects("recklessCharge")).toEqual(["charge", "fullatk"]);
    expect(baseIsCharge("recklessCharge") && baseIsFullAttack("recklessCharge")).toBe(true);
    expect(baseIsCharge("fullatk")).toBe(false);
    expect(baseIsFullAttack("charge")).toBe(false);
    expect(baseIsCharge("standard") || baseIsFullAttack("standard") || baseIsCharge(undefined)).toBe(false);
  });
  it("список Баз Приёма: составная проходит, только если разрешены обе части", () => {
    expect(baseFitsList(["charge", "fullatk"], "recklessCharge")).toBe(true);
    expect(baseFitsList(["standard", "charge", "fullatk"], "recklessCharge")).toBe(true);
    expect(baseFitsList(["standard", "charge", "careful"], "recklessCharge")).toBe(false);
    expect(baseFitsList(["charge"], "recklessCharge")).toBe(false);
    expect(baseFitsList(undefined, "recklessCharge")).toBe(true);
    expect(baseFitsList(["charge"], "charge")).toBe(true);
  });
  it("данные Базы: Полное действие, приём +30 (Полной Атаки), нужен Талант", () => {
    expect(MELEE_BASES.recklessCharge).toMatchObject({ actionType: "Полное действие", wsBonus: 30, requiresCapability: RECKLESS });
  });
});

describe("Таланты Берсерка видят составную Базу как обе", () => {
  it("Натиск Берсерка +10 и общий бонус Базы 30 + 10", () => {
    const a = holder([named("Berserk Charge")]);
    expect(berserkChargeBonus(a, "recklessCharge")).toBe(10);
    expect(meleeBaseBonus(a, "recklessCharge")).toBe(40);
    expect(meleeBaseBonus(holder(), "recklessCharge")).toBe(30);
  });
  it("Удар Молота, Смертельный Удар, Яростный Штурм, Пересилить — как на Полной Атаке", () => {
    expect(hammerBlowEffect(holder([named("Hammer Blow")]), { isMelee: true, baseKey: "recklessCharge", wsBonus: 6 }))
      .toEqual({ pen: 3, concussive: 2 });
    expect(killingStrikeApplies(holder([named("Killing Strike")]), { isMelee: true, baseKey: "recklessCharge", toggles: { killingStrike: true } })).toBe(true);
    expect(furiousAssaultOffered(holder([named("Furious Assault")]), { isMelee: true, baseKey: "recklessCharge", hit: true })).toBe(true);
    expect(overpowerOffered(holder([named("Overpower")]), { baseKey: "recklessCharge", parried: true })).toBe(true);
  });
  it("предикат meleeBaseIs: составная База отвечает на «charge», «fullatk» и на своё имя", () => {
    const a = { system: { meleeBase: "recklessCharge" } };
    expect(PREDICATES.meleeBaseIs(a, {}, "charge")).toBe(true);
    expect(PREDICATES.meleeBaseIs(a, {}, ["fullatk"])).toBe(true);
    expect(PREDICATES.meleeBaseIs(a, {}, "recklessCharge")).toBe(true);
    expect(PREDICATES.meleeBaseIs({ system: { meleeBase: "standard" } }, {}, "charge")).toBe(false);
  });
});

describe("окно атаки: пилюля Базы и Приёмы", () => {
  function selectionFor(actor) {
    const item = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
    return buildSelection({
      actor, atkProfiles: [], bowMarkedMod: 0, categoryFor: () => "Меч", fullAttackForced: false,
      gripKey: "П", gripList: ["П"], hasShieldEquipped: false, isMelee: true, isMounted: false, item,
      maneuverKeyDefault: "standard", meleeBaseKey: "standard", primGrip: "П", profIdx: -1, sBonus: 4,
      stance: "standard", sys: item.system, targetActor: null, trainingFor: () => ({ trained: true, source: "" }),
      wp: { cheapShot: false }
    });
  }
  it("носителю Таланта пилюля есть и доступна; без Таланта её нет вовсе", () => {
    const withIt = selectionFor(actorFor({ items: [talentByKey(RECKLESS)] })).computeBaseOptions("standard", "П");
    expect(withIt.find(o => o.key === "recklessCharge")).toMatchObject({ allowed: true });
    const without = selectionFor(actorFor({})).computeBaseOptions("standard", "П");
    expect(without.find(o => o.key === "recklessCharge")).toBeUndefined();
  });
  it("Стойка, закрывающая Натиск, закрывает и составную Базу", () => {
    const o = selectionFor(actorFor({ items: [talentByKey(RECKLESS)] })).computeBaseOptions("defensive", "П");
    expect(o.find(x => x.key === "recklessCharge")).toMatchObject({ allowed: false });
  });
  it("Приёмы: «Оглушить» допускает составную Базу, «Обратный Удар» — нет", () => {
    expect(baseFitsList(MELEE_MANEUVERS.stun.bases, "recklessCharge")).toBe(true);
    expect(baseFitsList(MELEE_MANEUVERS.reverseStrike.bases, "recklessCharge")).toBe(false);
  });
  it("встречные тесты, разрешённые и на Натиске, и на Полной Атаке, допускают составную Базу", () => {
    const both = Object.values(MELEE_CONTESTS).filter(c => c.bases?.includes("charge") && c.bases.includes("fullatk"));
    for (const c of both) expect(baseFitsList(c.bases, "recklessCharge")).toBe(true);
  });
});

