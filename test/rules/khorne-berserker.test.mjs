// test/rules/khorne-berserker.test.mjs
//
// Берсерк Кхорна (Sahara 1-54b9): чистая часть rules/khorne-berserker.mjs на настоящих записях пака,
// Гвозди Мясника через реестр правил (вне Ярости −10, в Ярости Hatred (Все!)), Ему Не Важно в бонусе Базы,
// Аватар Резни на манёврах-Состязаниях.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  hasButchersNails, hasUnstoppableWrath, hasForHeCaresNot, hasRedStreak, hasPaintItRed, hasTemperedInBlood,
  hasBloodOffering, hasSkullOffering, isRendingMelee, hasRendingMeleeWeapon, khorneBerserkerRules, nailsThreshold,
  nailsTestNeeded, nailsForcePeril, isBleeding, forHeCaresNotBonus, extraFuriousReactionReady, wrathKeeps,
  bloodOfferingDamage, bloodOfferingMark, bloodOfferingActive, bloodOfferingTurnEnd, skullOfferingMark, skullOfferingBonus,
  paintItRedApplies, rolledEightOnAnyDie, paintItRedNeedsBleedPill, temperedAdd, temperedWeaponHeld, temperedRules,
  FOR_HE_CARES_NOT_FLAG
} from "../../module/rules/khorne-berserker.mjs";
import { meleeBaseBonus } from "../../module/rules/berserker-talents.mjs";
import { hatredTargetsOf } from "../../module/rules/predicates.mjs";
import { anyTargetMatches } from "../../module/rules/talent-targets.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : [];
});
const docsIn = rel => walk(path.join(ROOT, "packs-src", rel)).map(f => JSON.parse(fs.readFileSync(f, "utf8"))).filter(d => d.name);
const named = (rel, part) => docsIn(rel).find(d => d.name.includes(part));

const TRAITS = "traits/Элитные_архетипы/Берсерк_Кхорна";
const TALENTS = "talents/Элитные_архетипы/Берсерк_Кхорна";
const nails = () => named(TRAITS, "Butcher's Nails");
const wrath = () => named(TRAITS, "Unstoppable Wrath");
const talent = part => named(TALENTS, part);

let seq = 0;
const asItem = (doc, extra = {}) => ({
  ...doc, id: `it${++seq}`, system: { ...(doc.system ?? {}), equipped: true, ...extra },
  getFlag: (s, k) => doc.flags?.[s]?.[k], toObject: () => JSON.parse(JSON.stringify(doc))
});
function actorOf(items = [], { inRage = false, bleeding = false, flags = {}, cor = 4 } = {}) {
  return {
    type: "character", uuid: "Actor.berserker", items: items.map(i => (i.getFlag ? i : asItem(i))),
    system: { inRage, conditions: { bleeding }, corruptionBonus: cor, characteristics: { wp: { total: 40, bonus: 4 } } },
    getFlag: (s, k) => flags[`${s}.${k}`]
  };
}
const weapon = (damageType = "rending", weaponClass = "melee") =>
  asItem({ type: "weapon", name: "Клинок", system: { weaponClass, damageType } });

describe("опознание способностей Берсерка Кхорна по настоящим записям пака", () => {
  it("Черты и Таланты читаются на актёре, владеющем записью", () => {
    expect(hasButchersNails(actorOf([nails()]))).toBe(true);
    expect(hasUnstoppableWrath(actorOf([wrath()]))).toBe(true);
    expect(hasForHeCaresNot(actorOf([talent("For He Cares Not")]))).toBe(true);
    expect(hasRedStreak(actorOf([talent("Red Streak")]))).toBe(true);
    expect(hasPaintItRed(actorOf([talent("Paint It Red")]))).toBe(true);
    expect(hasTemperedInBlood(actorOf([talent("Tempered in Blood")]))).toBe(true);
    expect(hasBloodOffering(actorOf([talent("Blood Offering")]))).toBe(true);
    expect(hasSkullOffering(actorOf([talent("Skull Offering")]))).toBe(true);
  });

  it("если переименовать запись, ключ в Механике всё равно опознаёт способность", () => {
    for (const [doc, check] of [
      [nails(), hasButchersNails], [wrath(), hasUnstoppableWrath], [talent("For He Cares Not"), hasForHeCaresNot],
      [talent("Red Streak"), hasRedStreak], [talent("Paint It Red"), hasPaintItRed],
      [talent("Tempered in Blood"), hasTemperedInBlood], [talent("Blood Offering"), hasBloodOffering],
      [talent("Skull Offering"), hasSkullOffering]
    ]) {
      expect(check(actorOf([{ ...doc, name: "Совсем другое имя" }]))).toBe(true);
    }
  });

  it("у актёра без этих записей — ничего", () => {
    const empty = actorOf();
    for (const check of [hasButchersNails, hasUnstoppableWrath, hasForHeCaresNot, hasRedStreak, hasPaintItRed,
      hasTemperedInBlood, hasBloodOffering, hasSkullOffering]) expect(check(empty)).toBe(false);
  });

  it("каждая запись несёт ключ Возможности, который есть в реестре", async () => {
    const { CAPABILITIES } = await import("../../module/constants/capabilities.mjs");
    for (const doc of [nails(), wrath(), ...["For He Cares Not", "Red Streak", "Paint It Red", "Tempered in Blood",
      "Blood Offering", "Skull Offering"].map(talent)]) {
      const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries.map(e => e.capabilityKey));
      expect(keys.length, doc.name).toBeGreaterThan(0);
      for (const k of keys) expect(CAPABILITIES[k], `${doc.name}: ${k}`).toBeTruthy();
    }
  });

  it("R Dmg — рукопашное оружие с типом урона rending", () => {
    expect(isRendingMelee(weapon())).toBe(true);
    expect(isRendingMelee(weapon("impact"))).toBe(false);
    expect(isRendingMelee(weapon("rending", "basic"))).toBe(false);
    expect(hasRendingMeleeWeapon(actorOf([weapon()]))).toBe(true);
    expect(hasRendingMeleeWeapon(actorOf([weapon("energy")]))).toBe(false);
  });
});

describe("Гвозди Мясника: вне Ярости −10 на социальные тесты и манифестацию", () => {
  it("источник правил отдаёт штраф только носителю вне Ярости", () => {
    expect(khorneBerserkerRules(actorOf([nails()]))).toHaveLength(1);
    expect(khorneBerserkerRules(actorOf([nails()], { inRage: true }))).toEqual([]);
    expect(khorneBerserkerRules(actorOf())).toEqual([]);
  });

  it("через resolveTest: социальный навык и манифестация −10, обычный навык — нет", () => {
    const a = actorOf([nails()]);
    const social = resolveTest({ actor: a, kind: "skill", skill: "charm", char: "fel" }).autoMods;
    expect(social.map(m => m.value)).toEqual([-10]);
    const power = resolveTest({ actor: a, kind: "power", char: "wp" }).autoMods;
    expect(power.map(m => m.value)).toEqual([-10]);
    expect(resolveTest({ actor: a, kind: "skill", skill: "athletics", char: "s" }).autoMods).toEqual([]);
  });

  it("в Ярости штраф снят", () => {
    const a = actorOf([nails()], { inRage: true });
    expect(resolveTest({ actor: a, kind: "skill", skill: "charm", char: "fel" }).autoMods.some(m => m.value === -10)).toBe(false);
  });

  it("порог срыва — W+10 с модификаторами", () => {
    expect(nailsThreshold(40)).toBe(50);
    expect(nailsThreshold(40, -10)).toBe(40);
  });

  it("тест срыва нужен только носителю вне Ярости при непоглощённом уроне", () => {
    expect(nailsTestNeeded(actorOf([nails()]), 3)).toBe(true);
    expect(nailsTestNeeded(actorOf([nails()]), 0)).toBe(false);
    expect(nailsTestNeeded(actorOf([nails()], { inRage: true }), 3)).toBe(false);
    expect(nailsTestNeeded(actorOf(), 3)).toBe(false);
    const down = actorOf([nails()]);
    down.system.conditions.unconscious = true;
    expect(nailsTestNeeded(down, 3)).toBe(false);
  });

  it("Прорыв на каждой манифестации — у носителя", () => {
    expect(nailsForcePeril(actorOf([nails()]))).toBe(true);
    expect(nailsForcePeril(actorOf())).toBe(false);
  });
});

describe("Гвозди Мясника: в Ярости Hatred (Все!)", () => {
  it("вне Ярости цели Ненависти нет", () => {
    expect(hatredTargetsOf(actorOf([nails()]))).toEqual([]);
  });

  it("в Ярости цель «Все!» подходит любой цели броска", () => {
    const targets = hatredTargetsOf(actorOf([nails()], { inRage: true }));
    expect(targets).toHaveLength(1);
    expect(targets[0].kind).toBe("all");
    expect(anyTargetMatches(targets, { targetActor: { type: "character", system: {} } })).toBe(true);
  });

  it("через resolveTest: +10 на рукопашную атаку по любой цели только в Ярости", () => {
    const target = { uuid: "Actor.t", type: "character", system: {}, items: [] };
    const raging = resolveTest({ actor: actorOf([nails()], { inRage: true }), kind: "attack", weaponClass: "melee", isMelee: true, targetActor: target });
    // Ненависть +10 — auto (с 13.11.2026): едет в autoMods, а не галочкой в mods
    expect(raging.autoMods.some(m => m.ruleId === "hatred.meleeBonus" && m.value === 10)).toBe(true);
    const calm = resolveTest({ actor: actorOf([nails()]), kind: "attack", weaponClass: "melee", isMelee: true, targetActor: target });
    expect(calm.autoMods.some(m => m.ruleId === "hatred.meleeBonus")).toBe(false);
    expect(calm.mods.some(m => m.ruleId === "hatred.meleeBonus")).toBe(false);
  });

  it("Нет Гвоздей — Ярость сама Ненависти не даёт", () => {
    expect(hatredTargetsOf(actorOf([], { inRage: true }))).toEqual([]);
  });
});

describe("Ему Не Важно", () => {
  const berserker = (over = {}) => actorOf([talent("For He Cares Not")], { bleeding: true, ...over });

  it("+20 на Полную Атаку только при Кровотечении", () => {
    expect(forHeCaresNotBonus(berserker(), "fullatk")).toBe(20);
    expect(forHeCaresNotBonus(berserker({ bleeding: false }), "fullatk")).toBe(0);
    expect(forHeCaresNotBonus(berserker(), "standard")).toBe(0);
    expect(forHeCaresNotBonus(actorOf([], { bleeding: true }), "fullatk")).toBe(0);
  });

  it("прибавка входит в бонус Базы рукопашной атаки", () => {
    const base = meleeBaseBonus(actorOf(), "fullatk");
    expect(meleeBaseBonus(berserker(), "fullatk")).toBe(base + 20);
    expect(meleeBaseBonus(berserker(), "standard")).toBe(meleeBaseBonus(actorOf(), "standard"));
  });

  it("дополнительная Реакция: есть при Кровотечении и пока не потрачена", () => {
    expect(isBleeding(berserker())).toBe(true);
    expect(extraFuriousReactionReady(berserker())).toBe(true);
    expect(extraFuriousReactionReady(berserker({ flags: { [`warhammer-dbc.${FOR_HE_CARES_NOT_FLAG}`]: true } }))).toBe(false);
    expect(extraFuriousReactionReady(berserker({ bleeding: false }))).toBe(false);
  });
});

describe("Неостановимый Гнев: что остаётся живым после успеха", () => {
  const btn = (cls, dataset = {}) => ({ classList: { contains: c => c === cls }, dataset });

  it("Кровотечение остаётся", () => {
    expect(wrathKeeps(btn("wh-crit-apply-btn", { condKey: "bleeding" }))).toBe(true);
    expect(wrathKeeps(btn("wh-crit-bleed-test-btn"))).toBe(true);
  });

  it("Оглушение, Усталость, урон в Характеристики, «Выронить» гасятся", () => {
    expect(wrathKeeps(btn("wh-crit-apply-btn", { condKey: "stunned" }))).toBe(false);
    expect(wrathKeeps(btn("wh-crit-apply-btn", { condKey: "fatigued" }))).toBe(false);
    expect(wrathKeeps(btn("wh-char-dmg-btn"))).toBe(false);
    expect(wrathKeeps(btn("wh-crit-drop-btn"))).toBe(false);
  });

  it("Смерть гасится, пока право «раз за бой» этой карточки; иначе остаётся живой", () => {
    expect(wrathKeeps(btn("wh-crit-death-btn"), { deathIgnored: true })).toBe(false);
    expect(wrathKeeps(btn("wh-shock-death-btn"), { deathIgnored: true })).toBe(false);
    expect(wrathKeeps(btn("wh-crit-death-btn"), { deathIgnored: false })).toBe(true);
    expect(wrathKeeps(btn("wh-shock-death-btn"), { deathIgnored: false })).toBe(true);
  });
});

describe("Кровавое Подношение", () => {
  it("+½Cor.b, округление вверх", () => {
    expect(bloodOfferingDamage(4)).toBe(2);
    expect(bloodOfferingDamage(5)).toBe(3);
    expect(bloodOfferingDamage(0)).toBe(0);
  });

  it("метка живёт Cor.b Ходов (минимум 1), только для того же оружия и боя", () => {
    const mark = bloodOfferingMark({ weaponUuid: "W", corBonus: 3, combatId: "c1" });
    expect(mark).toEqual({ weaponUuid: "W", turnsLeft: 3, combatId: "c1" });
    expect(bloodOfferingMark({ weaponUuid: "W", corBonus: 0 }).turnsLeft).toBe(1);
    expect(bloodOfferingMark({ weaponUuid: "W", corBonus: 3, combatId: "c1", ownTurn: true }).turnsLeft).toBe(4);
    expect(bloodOfferingActive(mark, "W", "c1")).toBe(true);
    expect(bloodOfferingActive(mark, "OTHER", "c1")).toBe(false);
    expect(bloodOfferingActive(mark, "W", "c2")).toBe(false);
    expect(bloodOfferingActive(null, "W", "c1")).toBe(false);
  });

  it("конец Хода убавляет счётчик, на нуле метка теряется", () => {
    let mark = bloodOfferingMark({ weaponUuid: "W", corBonus: 2, combatId: "c1" });
    mark = bloodOfferingTurnEnd(mark);
    expect(mark.turnsLeft).toBe(1);
    expect(bloodOfferingTurnEnd(mark)).toBeNull();
    expect(bloodOfferingTurnEnd(null)).toBeNull();
  });
});

describe("Подношение Черепов", () => {
  const withMark = (combatId, items = [talent("Skull Offering")]) =>
    actorOf(items, { flags: { "warhammer-dbc.skullOffering": skullOfferingMark(combatId) } });

  it("+2 Dmg на рукопашную атаку в бою метки", () => {
    expect(skullOfferingBonus(withMark("c1"), { isMelee: true, combatId: "c1" })).toBe(2);
  });

  it("не стрельба, не другой бой, не без Таланта, не без метки", () => {
    expect(skullOfferingBonus(withMark("c1"), { isMelee: false, combatId: "c1" })).toBe(0);
    expect(skullOfferingBonus(withMark("c1"), { isMelee: true, combatId: "c2" })).toBe(0);
    expect(skullOfferingBonus(withMark("c1", []), { isMelee: true, combatId: "c1" })).toBe(0);
    expect(skullOfferingBonus(actorOf([talent("Skull Offering")]), { isMelee: true, combatId: "c1" })).toBe(0);
  });
});

describe("Окрась Всё в Красный", () => {
  it("работает только на рукопашное R-оружие носителя", () => {
    const a = actorOf([talent("Paint It Red")]);
    expect(paintItRedApplies(a, weapon())).toBe(true);
    expect(paintItRedApplies(a, weapon("impact"))).toBe(false);
    expect(paintItRedApplies(actorOf(), weapon())).toBe(false);
  });

  it("8 на любом кубике, в том числе отброшенном, считается", () => {
    const roll = results => ({ terms: [{ faces: 10, results: results.map(([result, active]) => ({ result, active })) }] });
    expect(rolledEightOnAnyDie(roll([[3, true], [8, false]]))).toBe(true);
    expect(rolledEightOnAnyDie(roll([[8, true]]))).toBe(true);
    expect(rolledEightOnAnyDie(roll([[7, true], [9, true]]))).toBe(false);
    expect(rolledEightOnAnyDie({ terms: [] })).toBe(false);
  });

  it("пилюля Кровотечения добавляется, только если безусловной ещё нет", () => {
    expect(paintItRedNeedsBleedPill([])).toBe(true);
    expect(paintItRedNeedsBleedPill([{ key: "stunned", formula: "1d5" }])).toBe(true);
    expect(paintItRedNeedsBleedPill([{ key: "bleeding", formula: null }])).toBe(false);
  });
});

describe("Закалённое в Крови", () => {
  it("метка копит оружие в бою и сбрасывается новым боем", () => {
    const first = temperedAdd(undefined, "w1", "c1");
    expect(first).toEqual({ combatId: "c1", weaponIds: ["w1"] });
    expect(temperedAdd(first, "w2", "c1").weaponIds).toEqual(["w1", "w2"]);
    expect(temperedAdd(first, "w1", "c1").weaponIds).toEqual(["w1"]);
    expect(temperedAdd(first, "w3", "c2")).toEqual({ combatId: "c2", weaponIds: ["w3"] });
  });

  it("пока экипировано отмеченное оружие, выбить его нельзя (возможность combat.cannotBeDisarmed)", () => {
    const blade = weapon();
    const a = actorOf([talent("Tempered in Blood"), blade], {
      flags: { "warhammer-dbc.temperedInBlood": { combatId: "c1", weaponIds: [blade.id] } }
    });
    expect(temperedWeaponHeld(a, "c1")).toBe(true);
    expect(temperedRules(a, "c1")).toHaveLength(1);
    expect(temperedWeaponHeld(a, "c2")).toBe(false);
    expect(temperedRules(a, "c2")).toEqual([]);
  });

  it("без Таланта или без отмеченного оружия — нет", () => {
    const blade = weapon();
    const marked = { "warhammer-dbc.temperedInBlood": { combatId: "c1", weaponIds: [blade.id] } };
    expect(temperedWeaponHeld(actorOf([blade], { flags: marked }), "c1")).toBe(false);
    expect(temperedWeaponHeld(actorOf([talent("Tempered in Blood")]), "c1")).toBe(false);
  });

  it("через реестр правил возможность читается у актёра", () => {
    const blade = weapon();
    const a = actorOf([talent("Tempered in Blood"), blade], {
      flags: { "warhammer-dbc.temperedInBlood": { combatId: "", weaponIds: [blade.id] } }
    });
    expect(hasRuleFlag(a, "combat.cannotBeDisarmed")).toBe(true);
    expect(hasRuleFlag(actorOf([talent("Tempered in Blood"), blade]), "combat.cannotBeDisarmed")).toBe(false);
  });
});

describe("Аватар Резни: манёвры-Состязания", () => {
  const marked = berserkerUuid => {
    const flags = { "warhammer-dbc.avatarOfSlaughterMark": { berserkerUuid } };
    return { items: [], system: {}, getFlag: (s, k) => flags[`${s}.${k}`] };
  };

  it("манёвр против Берсерка — −20", () => {
    const { mods } = resolveTest({ actor: marked("Actor.b1"), kind: "skill", char: "ws", contest: true, targetActor: { uuid: "Actor.b1" } });
    expect(mods.map(m => m.value)).toEqual([-20]);
    expect(mods[0].label).toContain("манёвр");
  });

  it("манёвр против другой цели или обычный тест — штрафа нет", () => {
    expect(resolveTest({ actor: marked("Actor.b1"), kind: "skill", char: "ws", contest: true, targetActor: { uuid: "Actor.x" } }).mods).toEqual([]);
    expect(resolveTest({ actor: marked("Actor.b1"), kind: "skill", char: "ws", targetActor: { uuid: "Actor.b1" } }).mods).toEqual([]);
  });

  it("атака по Берсерку по-прежнему −20, и ровно один раз", () => {
    const { mods } = resolveTest({ actor: marked("Actor.b1"), kind: "attack", targetActor: { uuid: "Actor.b1" } });
    expect(mods.map(m => m.value)).toEqual([-20]);
  });

  it("окно Состязания действительно ставит ctx.contest", () => {
    const src = fs.readFileSync(path.join(ROOT, "module/combat/techniques.mjs"), "utf8");
    expect(src.match(/contest: true/g)?.length).toBe(2);
  });
});
