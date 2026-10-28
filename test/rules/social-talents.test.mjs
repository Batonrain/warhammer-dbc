// test/rules/social-talents.test.mjs
//
// Peer / Связи, Good Reputation / Хорошая Репутация, Enemy / Враг (Sahara
// peer-ancient-warrior-lord-of-war-excessive-wealth, часть «а», и 3-5e84;
// DoomBC — Основная книга, «Социальные», стр. 62).
//
// Книга:
//   Peer — «+10 ко всем социальным взаимодействиям с этой группой».
//   Good Reputation — «ещё +10 к тестам при работе с этой группой» (в сводной
//     таблице книги — «+20 на общение с фракцией»: те же +10 Связей и +10
//     Репутации; требование «Peer (Организация)» книга ставит сама).
//   Enemy — «штраф −10 ко всем социальным взаимодействиям с этой группой за
//     уровень Таланта», уровень 1–3.
//
// Образец — test/rules/hatred.test.mjs (rules/hatred.mjs): цель броска
// (ctx.targetActor) сверяется с system.targets Таланта.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { socialTalentRules, enemyLevel } from "../../module/rules/social-talents.mjs";
import { peerTargetsOf, goodReputationTargetsOf, enemyTalentsOf }
  from "../../module/rules/predicates.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { raceTarget, factionTarget, allTarget } from "../../module/rules/talent-targets.mjs";
import { setFactionIndex, clearFactionIndex } from "../../module/rules/factions.mjs";

const TREE = [
  { key: "imperium" },
  { key: "inquisition", parent: "imperium" },
  { key: "ordo-xenos", parent: "inquisition" },
  { key: "chaos" }
];
beforeEach(() => setFactionIndex(TREE));
afterEach(() => clearFactionIndex());

const talent = (name, targets = [], system = {}) => ({
  type: "talent", name, system: { targets, ...system }
});
const peer = targets => talent("Peer / Связи", targets);
const goodRep = targets => talent("Good Reputation / Хорошая Репутация", targets);
const enemy = (targets, rating = 1) =>
  talent("Enemy / Враг", targets, { hasRating: true, rating });
const actorWith = (...items) => ({ items });

const inFaction = key => ({ type: "character", system: {}, items: [{ type: "faction", system: { key } }] });
const social = (targetActor, skill = "charm") => ({ kind: "skill", skill, char: "fel", targetActor });

describe("peerTargetsOf / goodReputationTargetsOf / enemyTalentsOf", () => {
  it("собирают цели только со своих Талантов, по любой половине двуязычного имени", () => {
    const t = factionTarget({ key: "inquisition", name: "Инквизиция" });
    const actor = actorWith(
      talent("Связи", [t]),
      talent("Хорошая Репутация", [t]),
      talent("Враг", [t], { rating: 2 }),
      talent("Hatred / Ненависть", [raceTarget("ork")])
    );
    expect(peerTargetsOf(actor)).toEqual([t]);
    expect(goodReputationTargetsOf(actor)).toEqual([t]);
    expect(enemyTalentsOf(actor)).toEqual([{ level: 2, targets: [t] }]);
  });

  it("не принимают Таланты с похожим словом в имени за свои", () => {
    const t = raceTarget("ork");
    const actor = actorWith(
      talent("Know the Enemy / Познай врага", [t]),
      talent("Contact Network / Сеть Контактов", [t]),
      talent("Peerless / Беспримерный", [t])
    );
    expect(peerTargetsOf(actor)).toEqual([]);
    expect(goodReputationTargetsOf(actor)).toEqual([]);
    expect(enemyTalentsOf(actor)).toEqual([]);
  });

  it("узнают Талант со специализацией в скобках и суммируют несколько экземпляров", () => {
    const a = raceTarget("ork"), b = raceTarget("eldar");
    const actor = actorWith(talent("Peer (Orks) / Связи", [a]), peer([b]));
    expect(peerTargetsOf(actor)).toEqual([a, b]);
  });

  it("без Талантов и без актора — пусто, а не падение", () => {
    expect(peerTargetsOf(actorWith())).toEqual([]);
    expect(peerTargetsOf(null)).toEqual([]);
    expect(goodReputationTargetsOf(null)).toEqual([]);
    expect(enemyTalentsOf(null)).toEqual([]);
  });
});

describe("enemyLevel", () => {
  it("берёт Уровень из system.rating", () => {
    expect(enemyLevel({ system: { rating: 2 } })).toBe(2);
  });
  it("Враг без записанного Уровня считается первым", () => {
    expect(enemyLevel({ system: {} })).toBe(1);
    expect(enemyLevel({ system: { rating: 0 } })).toBe(1);
  });
  it("книга ограничивает Уровень тремя: 1–3", () => {
    expect(enemyLevel({ system: { rating: 4 } })).toBe(3);
    expect(enemyLevel({ system: { rating: -2 } })).toBe(1);
  });
});

describe("socialTalentRules — Связи", () => {
  const orkTarget = raceTarget("ork", "Орк");
  const orkActor = actorWith(peer([orkTarget]));
  const ork = { system: { race: "ork" } };

  it("цель из группы Связей — одно правило +10 на социальный тест, без галочки", () => {
    const rules = socialTalentRules(orkActor, social(ork));
    expect(rules.map(r => r.id)).toEqual(["social.peer"]);
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "social", value: 10, auto: true }]);
  });

  it("цель из чужой группы или без цели — правил нет", () => {
    expect(socialTalentRules(orkActor, social({ system: { race: "human" } }))).toEqual([]);
    expect(socialTalentRules(orkActor, { kind: "skill", skill: "charm" })).toEqual([]);
  });

  it("Связи без выбранной группы ничего не дают", () => {
    expect(socialTalentRules(actorWith(peer([])), social(ork))).toEqual([]);
  });

  it("фракция: цель из нижестоящей подходит под вышестоящую, обратно — нет", () => {
    const actor = actorWith(peer([factionTarget({ key: "inquisition", name: "Инквизиция" })]));
    expect(socialTalentRules(actor, social(inFaction("ordo-xenos"))).map(r => r.id)).toEqual(["social.peer"]);
    expect(socialTalentRules(actor, social(inFaction("imperium")))).toEqual([]);
  });

  it("два экземпляра Связей, под оба из которых попадает цель, дают +10 один раз", () => {
    const actor = actorWith(
      peer([factionTarget({ key: "imperium", name: "Империум" })]),
      peer([factionTarget({ key: "inquisition", name: "Инквизиция" })])
    );
    const rules = socialTalentRules(actor, social(inFaction("ordo-xenos")));
    expect(rules.filter(r => r.id === "social.peer")).toHaveLength(1);
  });

  it("у актора без Связей — правил нет", () => {
    expect(socialTalentRules(actorWith(), social(ork))).toEqual([]);
  });
});

describe("socialTalentRules — Хорошая Репутация", () => {
  const inquisition = factionTarget({ key: "inquisition", name: "Инквизиция" });
  const actor = actorWith(peer([inquisition]), goodRep([inquisition]));

  it("даёт ещё +10 отдельным правилом: вместе со Связями выходит +20", () => {
    const rules = socialTalentRules(actor, social(inFaction("inquisition")));
    expect(rules.map(r => r.id).sort()).toEqual(["social.goodReputation", "social.peer"]);
    const sum = rules.flatMap(r => r.effects).reduce((s, e) => s + e.value, 0);
    expect(sum).toBe(20);
  });

  it("действует и без Связей в списке: книга ставит «Peer» требованием к Таланту, не условием броска", () => {
    const rules = socialTalentRules(actorWith(goodRep([inquisition])), social(inFaction("inquisition")));
    expect(rules.map(r => r.id)).toEqual(["social.goodReputation"]);
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "social", value: 10, auto: true }]);
  });

  it("чужая группа — правил нет", () => {
    expect(socialTalentRules(actor, social(inFaction("chaos")))).toEqual([]);
  });
});

describe("socialTalentRules — Враг", () => {
  const chaos = factionTarget({ key: "chaos", name: "Хаос" });

  it("−10 за каждый Уровень Таланта", () => {
    for (const [level, want] of [[1, -10], [2, -20], [3, -30]]) {
      const rules = socialTalentRules(actorWith(enemy([chaos], level)), social(inFaction("chaos")));
      expect(rules.map(r => r.id)).toEqual(["social.enemy"]);
      expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "social", value: want, auto: true }]);
    }
  });

  it("чужая группа и отсутствие цели — штрафа нет", () => {
    const actor = actorWith(enemy([chaos], 3));
    expect(socialTalentRules(actor, social(inFaction("imperium")))).toEqual([]);
    expect(socialTalentRules(actor, { kind: "skill", skill: "charm" })).toEqual([]);
  });

  it("два Врага, под оба из которых попадает цель, — берётся худший Уровень, а не сумма", () => {
    const actor = actorWith(
      enemy([factionTarget({ key: "chaos", name: "Хаос" })], 1),
      enemy([factionTarget({ key: "chaos", name: "Хаос" })], 2)
    );
    const [rule] = socialTalentRules(actor, social(inFaction("chaos")));
    expect(rule.effects[0].value).toBe(-20);
  });

  it("Враги разных групп друг друга не задевают", () => {
    const actor = actorWith(enemy([chaos], 3), enemy([factionTarget({ key: "inquisition", name: "Инквизиция" })], 1));
    const [rule] = socialTalentRules(actor, social(inFaction("inquisition")));
    expect(rule.effects[0].value).toBe(-10);
  });

  it("Связи и Враг на одну группу складываются: +10 и −10", () => {
    const actor = actorWith(peer([chaos]), enemy([chaos], 1));
    const rules = socialTalentRules(actor, social(inFaction("chaos")));
    expect(rules.flatMap(r => r.effects).reduce((s, e) => s + e.value, 0)).toBe(0);
  });
});

describe("в настоящем конвейере теста (resolveTest, источник socialTalents)", () => {
  const inq = factionTarget({ key: "inquisition", name: "Инквизиция" });
  const sumAuto = r => r.autoMods.reduce((s, m) => s + m.value, 0);

  it("социальный тест против цели из группы получает автомодификатор с подписью", () => {
    const actor = { type: "character", system: {}, items: [peer([inq]), goodRep([inq]), enemy([factionTarget({ key: "chaos", name: "Хаос" })], 2)] };
    const r = resolveTest({ actor, ...social(inFaction("ordo-xenos")) });
    expect(sumAuto(r)).toBe(20);
    expect(r.autoMods.map(m => m.label).join(" | ")).toMatch(/Связи/);
    expect(sumAuto(resolveTest({ actor, ...social(inFaction("chaos")) }))).toBe(-20);
  });

  it("несоциальный навык, голая характеристика и атака модификатора не получают", () => {
    const actor = { type: "character", system: {}, items: [peer([allTarget()]), enemy([allTarget()], 3)] };
    const target = inFaction("inquisition");
    expect(sumAuto(resolveTest({ actor, kind: "skill", skill: "awareness", char: "per", targetActor: target }))).toBe(0);
    expect(sumAuto(resolveTest({ actor, kind: "skill", char: "fel", targetActor: target }))).toBe(0);
    expect(sumAuto(resolveTest({ actor, kind: "attack", isMelee: true, targetActor: target }))).toBe(0);
  });

  it("каждый из семи социальных навыков получает модификатор", () => {
    const actor = { type: "character", system: {}, items: [peer([inq])] };
    for (const skill of ["charm", "command", "commerce", "deceive", "inquiry", "interrogate", "intimidate"]) {
      expect(sumAuto(resolveTest({ actor, ...social(inFaction("inquisition"), skill) }))).toBe(10);
    }
  });
});
