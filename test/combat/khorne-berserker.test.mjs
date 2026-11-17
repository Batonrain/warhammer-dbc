// test/combat/khorne-berserker.test.mjs
//
// Берсерк Кхорна (Sahara 1-54b9), Foundry-обвязка module/combat/khorne-berserker.mjs и места подключения:
// Гвозди Мясника (карточка срыва в конвейере урона, Помеха на выход из Ярости), Красная Полоса,
// Ему Не Важно (Реакция на Яростный Штурм), Закалённое в Крови, Кровавое Подношение, Подношение Черепов,
// Неостановимый Гнев на карточке Критического Эффекта, Окрась Всё в Красный в конвейере урона.
// Актор — со схемой персонажа; Черты и Таланты — настоящие документы packs-src.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { attemptRageExit } from "../../module/combat/rage-behavior.mjs";
import {
  butchersNailsOnDamage, rollNailsTest, giveInToNails, provokeNails, useRedStreak, furiousExtraReactionAvailable,
  canPayFuriousReaction, payFuriousReaction, temperedOnDamage, bloodOfferingForAttack, consumeBloodOffering,
  khorneTurnEnd, clearKhorneCombat, registerKhorneKill, claimSkullOffering, paintItRedBleeds
} from "../../module/combat/khorne-berserker.mjs";
import { useUnstoppableWrath } from "../../module/combat/crit-talents-actions.mjs";
import { applyCritTalentState, critTalentsHtml } from "../../module/combat/crit-talents.mjs";
import { skullOfferingBonus } from "../../module/rules/khorne-berserker.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { CRIT_TALENT_FLAGS } from "../../module/combat/crit-talents.mjs";

const NS = "warhammer-dbc";
const TRAITS = "packs-src/traits/Элитные_архетипы/Берсерк_Кхорна";
const TALENTS = "packs-src/talents/Элитные_архетипы/Берсерк_Кхорна";
const NAILS = packDocById(TRAITS, "QmG6S84WqRsGnsuw");
const WRATH = packDocById(TRAITS, "jpu8vjEzp6NQyb5H");
const FOR_HE_CARES_NOT = packDocById(TALENTS, "wlETrJdL11jm8Oe9");
const RED_STREAK = packDocById(TALENTS, "vwzPn5yyppIrzN7S");
const PAINT_IT_RED = packDocById(TALENTS, "9B5Hq6g4z5KnMpl9");
const TEMPERED = packDocById(TALENTS, "zm2DghYdNWoGuPiL");
const BLOOD_OFFERING = packDocById(TALENTS, "xMmebIPjWRfx7qr1");
const SKULL_OFFERING = packDocById(TALENTS, "nagkL289eJqqIN62");
const FRENZY = packDocById("packs-src/talents/Берсерк", "FP1xN9yNXHr9vWw8");

let seq = 0;
const itemOf = (doc, extra = {}) => {
  const flags = { ...doc.flags };
  return { id: `i${++seq}`, uuid: `Actor.hero.Item.i${seq}`, type: doc.type, name: doc.name,
    system: { ...doc.system, equipped: true, ...extra }, flags, getFlag: (s, k) => flags[s]?.[k] };
};
const blade = (over = {}) => {
  const it = itemOf({ type: "weapon", name: "Силовой топор", system: { weaponClass: "melee", damageType: "rending" } });
  it.system = { ...it.system, ...over };
  return it;
};

function hero({ items = [], inRage = false, wounds = 20, bleeding = false, cor = 4, flags = {}, wp = 40, reactions = 2 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics)) system.characteristics[k].base = 40;
  system.characteristics.wp.base = wp;
  system.inRage = inRage;
  system.wounds.max = 20;
  system.wounds.value = wounds;
  system.conditions = { ...(system.conditions ?? {}), bleeding };
  system.reactions = { ...(system.reactions ?? {}), value: reactions, max: reactions, defenseValue: 0, strangeValue: 0 };
  system.actionPoints = { ...(system.actionPoints ?? {}), value: 2, max: 2 };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const store = { ...flags };
  const self = {
    id: "hero", uuid: "Actor.hero", name: "Берсерк", type: "character", system, items: list, isOwner: true,
    effects: Object.assign([], { contents: [] }), isToken: false,
    getFlag: (scope, key) => (scope === NS ? store[key] : undefined),
    setFlag: async (scope, key, value) => { store[key] = value; return self; },
    unsetFlag: async (scope, key) => { delete store[key]; return self; },
    getActiveTokens: () => [],
    update: async patch => {
      captured.updates.push(patch);
      for (const [path, value] of Object.entries(patch)) {
        if (path.startsWith("system.")) {
          const keys = path.slice("system.".length).split(".");
          let node = self.system;
          for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
          node[keys.at(-1)] = value;
        } else if (path.startsWith(`flags.${NS}.-=`)) delete store[path.slice(`flags.${NS}.-=`.length)];
        else if (path.startsWith(`flags.${NS}.`)) store[path.slice(`flags.${NS}.`.length)] = value;
      }
      return self;
    },
    deleteEmbeddedDocuments: async () => []
  };
  WarhammerActor.prototype.prepareDerivedData.call(self);
  self.system.corruptionBonus = cor;
  self.store = store;
  return self;
}

const lastCard = () => captured.chat.at(-1)?.content ?? "";
const cards = () => captured.chat.map(c => String(c.content));
const damage = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "rending", hitLocation: "Торс",
  attackerName: "Враг", weaponName: "Тестовое оружие", ...over
});
const inCombat = (actors, id = "c1") => {
  const list = Array.isArray(actors) ? actors : [actors];
  globalThis.game.combat = { id, round: 1, started: true, combatant: { actor: list[0] }, combatants: list.map(actor => ({ actor })) };
  globalThis.game.combats = [globalThis.game.combat];
};

const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  globalThis.game.time = { worldTime: 600 };
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.game.combat = undefined; delete globalThis.game.combats;
  globalThis.fromUuid = async () => null;
});

describe("Гвозди Мясника: срыв в Ярость", () => {
  it("непоглощённый урон выкладывает карточку-выбор с флагом для кнопок", async () => {
    const a = hero({ items: [itemOf(NAILS)] });
    await applyDamageToActor(a, damage());
    const card = captured.chat.find(c => String(c.content).includes("Гвозди Мясника"));
    expect(card).toBeTruthy();
    expect(card.content).toContain("wh-nails-roll-btn");
    expect(card.content).toContain("wh-nails-give-btn");
    expect(card.flags?.[NS]?.nailsGate?.actorUuid).toBe("Actor.hero");
    expect(captured.chat.some(c => String(c.content).includes("тест W+10 или Ярость — карточка в чате"))).toBe(true);
  });

  it("поглощённый урон, уже Ярость и чужой актор — карточки нет", async () => {
    const soaked = hero({ items: [itemOf(NAILS)] });
    soaked.system.absorption.body = 30;
    await applyDamageToActor(soaked, damage());
    expect(cards().some(c => c.includes("wh-nails-roll-btn"))).toBe(false);
    resetCaptured();
    await applyDamageToActor(hero({ items: [itemOf(NAILS)], inRage: true }), damage());
    expect(cards().some(c => c.includes("wh-nails-roll-btn"))).toBe(false);
    await applyDamageToActor(hero(), damage());
    expect(cards().some(c => c.includes("wh-nails-roll-btn"))).toBe(false);
  });

  it("тест W+10: порог 50 (W 40), провал — Ярость, успех — нет", async () => {
    const lost = hero({ items: [itemOf(NAILS)] });
    captured.nextRoll = 51;
    expect(await rollNailsTest(lost)).toBe(false);
    expect(lost.system.inRage).toBe(true);
    expect(lastCard()).toContain("<b>50</b>");
    const held = hero({ items: [itemOf(NAILS)] });
    captured.nextRoll = 50;
    expect(await rollNailsTest(held)).toBe(true);
    expect(held.system.inRage).toBe(false);
  });

  it("намеренный провал — сразу в Ярость без броска", async () => {
    const a = hero({ items: [itemOf(NAILS)] });
    const rollsBefore = captured.rolls.length;
    expect(await giveInToNails(a)).toBe(true);
    expect(a.system.inRage).toBe(true);
    expect(captured.rolls.length).toBe(rollsBefore);
    expect(await giveInToNails(a)).toBe(false);
  });

  it("кнопка «оскорбили / пригрозили» выкладывает ту же карточку; без Гвоздей — ничего", async () => {
    await provokeNails(hero({ items: [itemOf(NAILS)] }));
    expect(lastCard()).toContain("Оскорбление или угроза");
    resetCaptured();
    expect(await provokeNails(hero())).toBeNull();
    expect(captured.chat).toEqual([]);
  });

  it("вне Ярости −10 на социальный тест видно в расчёте правил актёра", async () => {
    const { resolveTest } = await import("../../module/rules/resolve-test.mjs");
    const a = hero({ items: [itemOf(NAILS)] });
    expect(resolveTest({ actor: a, kind: "skill", skill: "charm", char: "fel" }).autoMods.map(m => m.value)).toContain(-10);
  });
});

describe("Гвозди Мясника: Помеха на выход из Ярости", () => {
  const choice = { turns: 0, lost: false, battleRage: false };
  const raging = items => hero({ inRage: true, items });

  it("два броска, засчитывается худший: 10 и 90 — провал", async () => {
    inCombat(hero());
    const a = raging([itemOf(FRENZY), itemOf(NAILS)]);
    captured.dice = [10, 90];
    expect(await attemptRageExit(a, { choice })).toBe(false);
    expect(a.system.inRage).toBe(true);
    expect(lastCard()).toContain("Помеха (Гвозди Мясника)");
    expect(captured.rolls).toHaveLength(2);
  });

  it("оба броска ниже порога — выход состоялся", async () => {
    inCombat(hero());
    const a = raging([itemOf(FRENZY), itemOf(NAILS)]);
    captured.dice = [10, 20];
    expect(await attemptRageExit(a, { choice })).toBe(true);
    expect(a.system.inRage).toBe(false);
  });

  it("без Гвоздей бросок один и берётся он", async () => {
    inCombat(hero());
    const a = raging([itemOf(FRENZY)]);
    captured.dice = [10];
    expect(await attemptRageExit(a, { choice })).toBe(true);
    expect(captured.rolls).toHaveLength(1);
    expect(lastCard()).not.toContain("Помеха (Гвозди Мясника)");
  });
});

describe("Красная Полоса", () => {
  it("1 непоглощаемый R урон себе, по желанию Кровотечение; нужно R-оружие", async () => {
    const a = hero({ items: [itemOf(RED_STREAK), blade()] });
    captured.confirmAnswer = true;
    expect(await useRedStreak(a)).toBe(true);
    expect(a.system.wounds.value).toBe(19);
    expect(lastCard()).toContain("Красная Полоса");
  });

  it("без рукопашного R-оружия не работает", async () => {
    const a = hero({ items: [itemOf(RED_STREAK), blade({ damageType: "impact" })] });
    expect(await useRedStreak(a)).toBe(false);
    expect(a.system.wounds.value).toBe(20);
    expect(captured.warnings.join(" ")).toContain("R Dmg");
  });

  it("у носителя Гвоздей самоурон запускает карточку срыва", async () => {
    const a = hero({ items: [itemOf(RED_STREAK), itemOf(NAILS), blade()] });
    await useRedStreak(a);
    expect(cards().some(c => c.includes("wh-nails-roll-btn"))).toBe(true);
  });
});

describe("Ему Не Важно: дополнительная Реакция только на Яростный Штурм", () => {
  it("при Кровотечении платится сначала ею; обычные Реакции целы; метка гасится с Ходом", async () => {
    const a = hero({ items: [itemOf(FOR_HE_CARES_NOT)], bleeding: true, reactions: 1 });
    inCombat(a);
    expect(furiousExtraReactionAvailable(a)).toBe(true);
    expect(await payFuriousReaction(a)).toBe(true);
    expect(a.store.forHeCaresNotUsed).toBe(true);
    expect(a.system.reactions.value).toBe(1);
    expect(furiousExtraReactionAvailable(a)).toBe(false);
    expect(await payFuriousReaction(a)).toBe(true);
    expect(a.system.reactions.value).toBe(0);
    const { turnStartFlagClears } = await import("../../module/rules/turn-flags.mjs");
    expect(turnStartFlagClears(a)).toHaveProperty([`flags.${NS}.-=forHeCaresNotUsed`]);
  });

  it("без Кровотечения дополнительной Реакции нет: без обычных платить нечем", async () => {
    globalThis.game.combat = { id: "c1", started: true, round: 1 };
    const a = hero({ items: [itemOf(FOR_HE_CARES_NOT)], bleeding: false, reactions: 0 });
    expect(furiousExtraReactionAvailable(a)).toBe(false);
    expect(canPayFuriousReaction(a)).toBe(false);
    const b = hero({ items: [itemOf(FOR_HE_CARES_NOT)], bleeding: true, reactions: 0 });
    expect(canPayFuriousReaction(b)).toBe(true);
  });

  it("окно Яростного Штурма платит через payFuriousReaction", async () => {
    const fs = await import("node:fs");
    const hooks = fs.readFileSync("module/hooks.mjs", "utf8");
    expect(hooks).toMatch(/cardKey: FURIOUS_ASSAULT_CARD_FLAG, reaction: true, furious: true/);
    const dialog = fs.readFileSync("module/sheets/attack/dialog.mjs", "utf8");
    expect(dialog).toMatch(/pay\.furious \? payFuriousReaction\(actor\)/);
    expect(dialog).toMatch(/pay\.furious \? canPayFuriousReaction\(actor\)/);
  });
});

describe("Закалённое в Крови", () => {
  it("рукопашное R-оружие, нанёсшее урон, получает метку боя", async () => {
    const hand = blade();
    const a = hero({ items: [itemOf(TEMPERED), hand] });
    inCombat(a);
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === hand.uuid ? { ...hand, parent: a } : null);
    await temperedOnDamage(a.uuid, hand.uuid, 3);
    expect(a.store.temperedInBlood).toEqual({ combatId: "c1", weaponIds: [hand.id] });
  });

  it("нулевой урон, не R-оружие или нет Таланта — метки нет", async () => {
    const hand = blade();
    const a = hero({ items: [itemOf(TEMPERED), hand] });
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === hand.uuid ? { ...hand, parent: a } : null);
    await temperedOnDamage(a.uuid, hand.uuid, 0);
    expect(a.store.temperedInBlood).toBeUndefined();
    const blunt = blade({ damageType: "impact" });
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : { ...blunt, parent: a });
    await temperedOnDamage(a.uuid, blunt.uuid, 3);
    expect(a.store.temperedInBlood).toBeUndefined();
    const plain = hero({ items: [hand] });
    globalThis.fromUuid = async uuid => (uuid === plain.uuid ? plain : { ...hand, parent: plain });
    await temperedOnDamage(plain.uuid, hand.uuid, 3);
    expect(plain.store.temperedInBlood).toBeUndefined();
  });

  it("конвейер урона зовёт метку при ранении оружием", async () => {
    const hand = blade();
    const attacker = hero({ items: [itemOf(TEMPERED), hand] });
    const victim = hero();
    inCombat([attacker, victim]);
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : uuid === hand.uuid ? { ...hand, parent: attacker } : null);
    await applyDamageToActor(victim, damage({ attackerUuid: attacker.uuid, weaponUuid: hand.uuid, melee: true }));
    expect(attacker.store.temperedInBlood?.weaponIds).toEqual([hand.id]);
  });
});

describe("Кровавое Подношение и Подношение Черепов после убийства", () => {
  const killScene = ({ killerItems, weaponOver = {}, victimFlags = {} } = {}) => {
    const hand = blade(weaponOver);
    const killer = hero({ items: [...killerItems, hand], cor: 4 });
    const victim = hero({ flags: victimFlags });
    victim.name = "Жертва";
    hand.parent = killer;
    hand.actor = killer;
    inCombat([killer, victim]);
    return { killer, victim, hand };
  };

  it("Кровавое Подношение: метка на оружие, бонус +½Cor.b и Освящённое на следующее попадание, потом снимается", async () => {
    const { killer, victim, hand } = killScene({ killerItems: [itemOf(BLOOD_OFFERING)] });
    await registerKhorneKill(victim, hand);
    expect(killer.store.bloodOffering).toEqual({ weaponUuid: hand.uuid, turnsLeft: 5, combatId: "c1" });
    expect(bloodOfferingForAttack(killer, hand)).toEqual({ dmg: 2, sanctified: true });
    expect(bloodOfferingForAttack(killer, blade())).toEqual({ dmg: 0, sanctified: false });
    await consumeBloodOffering(killer, hand, false);
    expect(killer.store.bloodOffering).toBeTruthy();
    await consumeBloodOffering(killer, hand, true);
    expect(killer.store.bloodOffering).toBeUndefined();
    expect(bloodOfferingForAttack(killer, hand).dmg).toBe(0);
  });

  it("метка теряется за Cor.b Ходов без попаданий и с концом боя", async () => {
    const { killer, victim, hand } = killScene({ killerItems: [itemOf(BLOOD_OFFERING)] });
    await registerKhorneKill(victim, hand);
    await khorneTurnEnd(killer);
    expect(killer.store.bloodOffering.turnsLeft).toBe(4);
    for (let i = 0; i < 3; i++) await khorneTurnEnd(killer);
    expect(killer.store.bloodOffering.turnsLeft).toBe(1);
    await khorneTurnEnd(killer);
    expect(killer.store.bloodOffering).toBeUndefined();
    await registerKhorneKill(victim, hand);
    await clearKhorneCombat(globalThis.game.combat);
    expect(killer.store.bloodOffering).toBeUndefined();
  });

  it("не R-оружие, не рукопашное или нет Таланта — метки нет", async () => {
    const impact = killScene({ killerItems: [itemOf(BLOOD_OFFERING)], weaponOver: { damageType: "impact" } });
    await registerKhorneKill(impact.victim, impact.hand);
    expect(impact.killer.store.bloodOffering).toBeUndefined();
    const ranged = killScene({ killerItems: [itemOf(BLOOD_OFFERING)], weaponOver: { weaponClass: "basic" } });
    await registerKhorneKill(ranged.victim, ranged.hand);
    expect(ranged.killer.store.bloodOffering).toBeUndefined();
    const none = killScene({ killerItems: [] });
    await registerKhorneKill(none.victim, none.hand);
    expect(none.killer.store.bloodOffering).toBeUndefined();
  });

  it("Подношение Черепов: карточка с двумя кнопками; Реакция тратится, +2 Dmg до конца боя; без Реакции — если удар обезглавил", async () => {
    const { killer, victim, hand } = killScene({ killerItems: [itemOf(SKULL_OFFERING)] });
    await registerKhorneKill(victim, hand);
    const card = captured.chat.find(c => String(c.content).includes("wh-skull-offering-btn"));
    expect(card).toBeTruthy();
    expect(card.content).toContain('data-decapitated="0"');
    expect(card.content).toContain('data-decapitated="1"');
    expect(await claimSkullOffering(killer, { decapitated: false })).toBe(true);
    expect(killer.system.reactions.value).toBe(1);
    expect(skullOfferingBonus(killer, { isMelee: true, combatId: "c1" })).toBe(2);
    await clearKhorneCombat(globalThis.game.combat);
    expect(skullOfferingBonus(killer, { isMelee: true, combatId: "c1" })).toBe(0);
    expect(await claimSkullOffering(killer, { decapitated: true })).toBe(true);
    expect(killer.system.reactions.value).toBe(1);
  });

  it("Подношение Черепов без Реакции не принимается; метки лидера и лорда подсказываются в карточке", async () => {
    const scene = killScene({ killerItems: [itemOf(SKULL_OFFERING)], victimFlags: { leaderOrChampion: true } });
    await registerKhorneKill(scene.victim, scene.hand);
    expect(lastCard()).toContain("Лидер или чемпион по метке ГМа");
    globalThis.game.combat = { id: "c1", started: true, round: 1 };
    scene.killer.system.reactions.value = 0;
    expect(await claimSkullOffering(scene.killer, { decapitated: false })).toBe(false);
    expect(scene.killer.store.skullOffering).toBeUndefined();
  });
});

describe("Неостановимый Гнев на карточке Критического Эффекта", () => {
  const btn = (cls, dataset = {}) => {
    const el = { disabled: false, title: "", dataset, classList: { _s: new Set([cls]), contains(c) { return this._s.has(c); }, add(c) { this._s.add(c); } } };
    return el;
  };
  const SELECTORS = {
    effect: [".wh-crit-apply-btn", ".wh-char-dmg-btn", ".wh-crit-drop-btn", ".wh-crit-death-btn", ".wh-shock-death-btn"],
    talent: [".wh-final-push-btn", ".wh-never-die-btn", ".wh-pain-illusion-btn", ".wh-unstoppable-wrath-btn"]
  };
  const blockOf = buttons => ({
    querySelectorAll: sel => buttons.filter(b => sel.split(",").some(s => b.classList.contains(s.trim().slice(1)))),
    querySelector: sel => buttons.find(b => sel.split(",").some(s => b.classList.contains(s.trim().slice(1)))) ?? null
  });
  const crit = () => [
    btn("wh-crit-apply-btn", { condKey: "stunned" }), btn("wh-crit-apply-btn", { condKey: "bleeding" }),
    btn("wh-crit-apply-btn", { condKey: "fatigued" }), btn("wh-crit-death-btn"), btn("wh-unstoppable-wrath-btn")
  ];
  let msgSeq = 0;
  const message = () => {
    const flags = {};
    return { id: `m${++msgSeq}`, isOwner: true, flags, getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; } };
  };

  it("кнопка есть только у носителя Черты, ключи флагов в белом списке карточек", () => {
    expect(critTalentsHtml(hero({ items: [itemOf(WRATH)] }), {})).toContain("wh-unstoppable-wrath-btn");
    expect(critTalentsHtml(hero(), {})).not.toContain("wh-unstoppable-wrath-btn");
    for (const k of ["unstoppableWrathTried", "unstoppableWrathUsed", "unstoppableWrathDeath", "nailsGateResolved", "skullOfferingClaimed"]) {
      expect(CARD_ONCE_FLAGS).toContain(k);
    }
    expect(CRIT_TALENT_FLAGS.unstoppableWrathUsed).toBe("unstoppableWrathUsed");
    expect(SELECTORS.talent).toBeTruthy();
  });

  it("успех T+0: гаснут Оглушение, Усталость и Смерть; Кровотечение остаётся; право на Смерть потрачено", async () => {
    inCombat(hero());
    const a = hero({ items: [itemOf(WRATH)] });
    const buttons = crit();
    const msg = message();
    captured.nextRoll = 30;
    expect(await useUnstoppableWrath(a, { message: msg, block: blockOf(buttons) })).toBe(true);
    const [stun, bleed, fat, death] = buttons;
    expect(stun.disabled).toBe(true);
    expect(fat.disabled).toBe(true);
    expect(death.disabled).toBe(true);
    expect(bleed.disabled).toBe(false);
    expect(msg.flags[`${NS}.unstoppableWrathUsed`]).toBe(true);
    expect(msg.flags[`${NS}.unstoppableWrathDeath`]).toBe(true);
    expect(a.store["usageLimits.unstoppableWrathDeath"]).toBeTruthy();
    expect(lastCard()).toContain("Смерть игнорирована");
  });

  it("повторная показ карточки по флагам: Смерть игнорирована — погашена, Кровотечение живо", () => {
    const buttons = crit();
    const msg = message();
    msg.flags[`${NS}.unstoppableWrathUsed`] = true;
    msg.flags[`${NS}.unstoppableWrathDeath`] = true;
    const root = { querySelectorAll: sel => (sel === ".dmg-critical-block" ? [blockOf(buttons)] : []) };
    applyCritTalentState(msg, root);
    expect(buttons[3].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    expect(buttons[0].disabled).toBe(true);
  });

  it("Смерть игнорировалась раньше в этом бою — кнопка Смерти остаётся живой", async () => {
    inCombat(hero());
    const a = hero({ items: [itemOf(WRATH)], flags: { "usageLimits.unstoppableWrathDeath": { scope: "battle", used: true, battle: "c1" } } });
    const buttons = crit();
    const msg = message();
    captured.nextRoll = 30;
    await useUnstoppableWrath(a, { message: msg, block: blockOf(buttons) });
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[3].disabled).toBe(false);
    expect(msg.flags[`${NS}.unstoppableWrathDeath`]).toBeUndefined();
    expect(lastCard()).toContain("НЕ игнорируется");
  });

  it("провал T+0: ничего не гаснет, но попытка Раунда израсходована", async () => {
    inCombat(hero());
    const a = hero({ items: [itemOf(WRATH)] });
    const buttons = crit();
    const msg = message();
    captured.nextRoll = 99;
    await useUnstoppableWrath(a, { message: msg, block: blockOf(buttons) });
    expect(buttons[0].disabled).toBe(false);
    expect(msg.flags[`${NS}.unstoppableWrathUsed`]).toBeUndefined();
    const second = message();
    expect(await useUnstoppableWrath(a, { message: second, block: blockOf(crit()) })).toBe(false);
    expect(captured.warnings.join(" ")).toContain("уже испытан в этом Раунде");
  });

  it("без Черты кнопка не работает", async () => {
    expect(await useUnstoppableWrath(hero(), { message: message(), block: blockOf(crit()) })).toBe(false);
  });
});

describe("Окрась Всё в Красный: Кровотечение в Критическом Эффекте", () => {
  it("оружие носителя — да; чужое оружие и другой тип урона — нет", async () => {
    const hand = blade();
    const a = hero({ items: [itemOf(PAINT_IT_RED), hand] });
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === hand.uuid ? hand : null);
    expect(await paintItRedBleeds(a.uuid, hand.uuid)).toBe(true);
    expect(await paintItRedBleeds(a.uuid, "Actor.x.Item.none")).toBe(false);
    const blunt = blade({ damageType: "impact" });
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : blunt);
    expect(await paintItRedBleeds(a.uuid, blunt.uuid)).toBe(false);
    expect(await paintItRedBleeds("", hand.uuid)).toBe(false);
  });

  it("карточка урона: Критический Эффект, нанесённый таким оружием, несёт пилюлю Кровотечения", async () => {
    const hand = blade();
    const attacker = hero({ items: [itemOf(PAINT_IT_RED), hand] });
    const victim = hero({ wounds: 1 });
    inCombat([attacker, victim]);
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : uuid === hand.uuid ? hand : null);
    await applyDamageToActor(victim, damage({ rawDamage: 8, attackerUuid: attacker.uuid, weaponUuid: hand.uuid, melee: true }));
    const card = captured.chat.map(c => String(c.content)).find(c => c.includes("dmg-critical-block"));
    expect(card).toBeTruthy();
    expect(card).toMatch(/data-cond-key="bleeding"/);
  });

  it("без Таланта пилюля не навязывается", async () => {
    const hand = blade();
    const attacker = hero({ items: [hand] });
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : uuid === hand.uuid ? hand : null);
    expect(await paintItRedBleeds(attacker.uuid, hand.uuid)).toBe(false);
  });
});

describe("butchersNailsOnDamage напрямую", () => {
  it("возвращает строку для карточки урона только когда карточка выложена", async () => {
    expect(await butchersNailsOnDamage(hero(), 5)).toBe("");
    expect(await butchersNailsOnDamage(hero({ items: [itemOf(NAILS)] }), 0)).toBe("");
    expect(await butchersNailsOnDamage(hero({ items: [itemOf(NAILS)] }), 5)).toContain("Гвозди Мясника");
  });
});
