// test/rules/binary-dominion.test.mjs
//
// Бинарное Владычество и Бинарная Паства (Таланты Механикума гл. 3, Sahara
// 3-cc96 п.1-2; DoomBC — Основная книга). Владычество: «может использовать
// Tech-Use вместо Command в тестах командования сервиторами, роботами и
// Скитариями, считая свой уровень Риска равным 3 (при командовании Скитариями
// уровень Риска не может быть ниже 3)». Паства: «может брать миньонов-людей с
// Латами Скитарии или Трейтом Mechanicum Implants как Миньонов-машин (в расчёте
// требований и максимума Миньонов), но создавая их профили как людей».

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { binaryDominionCommandBonus, binaryDominionRisk, isBinaryCommandTarget, isSkitariiActor,
         isServitorOrRobot, effectiveMinionGroup, isFlockEligibleHuman, buildCountGroup, loyaltyGroupOf }
  from "../../module/rules/binary-dominion.mjs";
import { commandSubstitutionRules } from "../../module/rules/command-substitution.mjs";
import { groupTally, minionCapacity, slotUsage, minionLoyalty, talentRequirements } from "../../module/rules/minion-build.mjs";
import { MINION_GROUPS } from "../../module/constants/minions.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const trait = name => ({ type: "trait", name, system: {}, flags: {} });
const plate = (equipped = true) => ({ type: "armor", name: "Skitarii War Plate / Боевые Латы Скитарии", system: { equipped }, flags: {} });

const commander = (items = [{ type: "talent", name: "Binary Dominion / Бинарное Владычество", system: {} }],
                   { tech = 60, command = 35 } = {}) => ({
  type: "character", items,
  system: { characteristics: { inf: { total: 0 }, fel: { total: 0 }, wp: { total: 0 }, int: { total: 0 } },
            skills: { techUse: { total: tech }, command: { total: command } }, groupSkills: { forbiddenLore: [] } }
});
const servitor = () => ({ type: "minion", items: [], system: { minionType: "machine" } });
const human = () => ({ type: "character", items: [], system: {} });
const skitarius = () => ({ type: "character", items: [], system: { archetype: "skitarii" } });

describe("кто такие «сервиторы, роботы и Скитарии»", () => {
  it("сервитор/робот — Миньон группы «Машина» (Персонаж-сервитор без слота Миньона не узнаётся)", () => {
    expect(isServitorOrRobot(servitor())).toBe(true);
    expect(isServitorOrRobot({ type: "character", items: [trait("Machine / Машина (X)")], system: {} })).toBe(false);
    expect(isServitorOrRobot(human())).toBe(false);
    expect(isServitorOrRobot(null)).toBe(false);
  });
  it("Скитарий — по Архетипу или по надетым Латам", () => {
    expect(isSkitariiActor(skitarius())).toBe(true);
    expect(isSkitariiActor({ type: "character", items: [plate(true)], system: {} })).toBe(true);
    expect(isSkitariiActor({ type: "character", items: [plate(false)], system: {} })).toBe(false);
    expect(isBinaryCommandTarget(human())).toBe(false);
  });
});

describe("метки-Черты «Сервитор» и «Робот» (решение владельца 26.10.2026)", () => {
  // Настоящие документы пака Черт, а не выдуманные литералы (форма фикстуры).
  const real = name => {
    const hit = packDocuments("traits", "trait").find(d => String(d.doc.name).startsWith(name));
    expect(hit, `в packs-src/traits нет Черты «${name}»`).toBeTruthy();
    return hit.doc;
  };
  const withTrait = item => ({ type: "character", items: [item], system: {} });

  it("Персонаж с меткой «Servitor» или «Robot» узнаётся без слота Миньона", () => {
    expect(isServitorOrRobot(withTrait(real("Servitor /")))).toBe(true);
    expect(isServitorOrRobot(withTrait(real("Robot /")))).toBe(true);
  });
  it("метка работает и как цель Бинарного Владычества (Tech-Use вместо Command, Риск 3)", () => {
    const target = withTrait(real("Servitor /"));
    expect(binaryDominionCommandBonus(commander(), { targetActor: target })).toBe(25);
    expect(binaryDominionRisk(commander(), 1, [target])).toBe(3);
  });
  it("опознание по ключу: переименованная метка с записью Конструктора всё равно узнаётся", () => {
    const renamed = { ...real("Robot /"), name: "Что-то своё" };
    expect(isServitorOrRobot(withTrait(renamed))).toBe(true);
  });
  it("другая Черта (Machine) и пустой актор — не сервитор", () => {
    expect(isServitorOrRobot(withTrait(real("Machine /")))).toBe(false);
    expect(isServitorOrRobot({ type: "character", items: [], system: {} })).toBe(false);
  });
});

describe("Бинарное Владычество: Tech-Use вместо Command", () => {
  it("цель — сервитор: прибавка = Tech-Use − Command", () => {
    expect(binaryDominionCommandBonus(commander(), { targetActor: servitor() })).toBe(25);
    expect(binaryDominionCommandBonus(commander(), { targetActor: skitarius() })).toBe(25);
  });
  it("цель — обычный человек или нет цели: подмены нет", () => {
    expect(binaryDominionCommandBonus(commander(), { targetActor: human() })).toBe(0);
    expect(binaryDominionCommandBonus(commander(), {})).toBe(0);
  });
  it("Tech-Use ниже Command — не хуже обычного (игрок выбирает, что использовать)", () => {
    expect(binaryDominionCommandBonus(commander(undefined, { tech: 20, command: 50 }), { targetActor: servitor() })).toBe(0);
  });
  it("без Таланта — 0", () => {
    expect(binaryDominionCommandBonus(commander([]), { targetActor: servitor() })).toBe(0);
  });

  it("в общем источнике подмен Command: Владычество — одно из кандидатов, берётся лучшее", () => {
    const rules = commandSubstitutionRules(commander(), { targetActor: servitor() });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("binaryDominion.command");
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "skill:command", value: 25 });
  });
  it("с Живой Легендой берётся большая подмена", () => {
    const a = commander([talent("Binary Dominion"), talent("Living Legend")]);
    a.system.characteristics.inf.total = 90;   // Inf 90 − F 0 = 90 > 25
    const rules = commandSubstitutionRules(a, { targetActor: servitor() });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("livingLegend.command");
    // и наоборот: слабая Легенда — побеждает Владычество
    a.system.characteristics.inf.total = 10;
    expect(commandSubstitutionRules(a, { targetActor: servitor() })[0].id).toBe("binaryDominion.command");
  });
});

describe("Бинарное Владычество: уровень Риска", () => {
  const dom = commander();
  it("отряд сервиторов — Риск ровно 3 (и выше, и ниже)", () => {
    expect(binaryDominionRisk(dom, 1, [servitor(), servitor()])).toBe(3);
    expect(binaryDominionRisk(dom, 5, [servitor()])).toBe(3);
  });
  it("отряд Скитариев — не ниже 3", () => {
    expect(binaryDominionRisk(dom, 1, [skitarius()])).toBe(3);
    expect(binaryDominionRisk(dom, 5, [skitarius()])).toBe(5);
  });
  it("смесь с обычными людьми, пустой отряд, нет Таланта — Риск не меняется", () => {
    expect(binaryDominionRisk(dom, 1, [servitor(), human()])).toBe(1);
    expect(binaryDominionRisk(dom, 2, [])).toBe(2);
    expect(binaryDominionRisk(commander([]), 1, [servitor()])).toBe(1);
  });
  it("смесь сервиторов и Скитариев — Скитарии не позволяют опустить, так что не ниже 3", () => {
    expect(binaryDominionRisk(dom, 5, [servitor(), skitarius()])).toBe(5);
    expect(binaryDominionRisk(dom, 1, [servitor(), skitarius()])).toBe(3);
  });
});

describe("Бинарная Паства: Миньон-человек в латах Скитария считается машиной", () => {
  const flock = () => ({ type: "character", items: [talent("Binary Flock / Бинарная Паства")],
    system: { characteristics: { fel: { total: 20 }, int: { total: 50 } } } });
  const humanMinion = (items = []) => ({ type: "minion", items, system: { minionType: "human" } });

  it("подходящий человек (латы / Mechanicum Implants) — «машина», прочие — «человек»", () => {
    const m1 = humanMinion([plate()]);
    const m2 = humanMinion([trait("Mechanicum Implants / Импланты Механикум")]);
    expect(isFlockEligibleHuman(m1)).toBe(true);
    expect(effectiveMinionGroup(flock(), m1)).toBe("machine");
    expect(effectiveMinionGroup(flock(), m2)).toBe("machine");
    expect(effectiveMinionGroup(flock(), humanMinion())).toBe("human");
  });
  it("без Таланта Паства не действует; настоящая машина остаётся машиной", () => {
    expect(effectiveMinionGroup({ type: "character", items: [], system: {} }, humanMinion([plate()]))).toBe("human");
    expect(effectiveMinionGroup(flock(), servitor())).toBe("machine");
  });
  it("максимум Миньонов считается по группе «машина» (Int), а не «человек» (Fel)", () => {
    const m = [humanMinion([plate()])];
    expect(groupTally(m, flock())).toEqual({ machine: 1 });
    expect(groupTally(m)).toEqual({ human: 1 });
    // Fel 20 → бонус 2; Int 50 → бонус 5
    expect(minionCapacity(flock(), Object.keys(groupTally(m, flock())))).toBe(5);
    expect(minionCapacity(flock(), Object.keys(groupTally(m)))).toBe(2);
  });
  // ── Галочка «считать как машину» в генераторе Миньона (решение владельца 26.10.2026) ──
  const flagged = (flag = true) => ({ type: "minion", items: [], flags: { "warhammer-dbc": { flockMachine: flag } },
    system: { minionType: "human", minionTier: "lesser", slotTalentId: "h1" } });

  it("выбор игрока: человек с отметкой — «машина» и без Лат, но только при Таланте", () => {
    expect(effectiveMinionGroup(flock(), flagged())).toBe("machine");
    expect(effectiveMinionGroup(flock(), flagged(false))).toBe("human");
    expect(effectiveMinionGroup({ type: "character", items: [], system: {} }, flagged())).toBe("human");
    // отметка не делает машиной зверя
    const beast = { type: "minion", items: [], flags: { "warhammer-dbc": { flockMachine: true } }, system: { minionType: "beast" } };
    expect(effectiveMinionGroup(flock(), beast)).toBe("beast");
  });
  it("группа счёта в генераторе: только человеческий профиль и только при Таланте", () => {
    expect(buildCountGroup(flock(), "human", true)).toBe("machine");
    expect(buildCountGroup(flock(), "human", false)).toBe("human");
    expect(buildCountGroup(flock(), "beast", true)).toBe("beast");
    expect(buildCountGroup({ type: "character", items: [], system: {} }, "human", true)).toBe("human");
  });
  it("Лояльность и требования отмеченного идут по Int/Tech-Use, профиль — человеческий", () => {
    const m = flock();                      // Fel 20, Int 50
    const asMachine = buildCountGroup(m, "human", true);
    expect(minionLoyalty(m, asMachine)).toBe(50);
    expect(minionLoyalty(m, "human")).toBe(20);
    expect(MINION_GROUPS[asMachine].reqSkill).toBe("Tech-Use");
    expect(talentRequirements(m, asMachine, "lesser").skillNote).toMatch(/^Tech-Use/);
    expect(talentRequirements(m, "human", "lesser").skillNote).toMatch(/^Command/);
  });
  it("кнопка «пересчитать Лояльность» на листе слуги берёт группу счёта, а не профиль", () => {
    expect(loyaltyGroupOf(flock(), flagged())).toBe("machine");
    expect(loyaltyGroupOf(flock(), flagged(false))).toBe("human");
    expect(loyaltyGroupOf({ type: "character", items: [], system: {} }, flagged())).toBe("human");
  });
  it("отмеченный слуга занимает слот, из которого создан (по slotTalentId), и считается машиной в максимуме", () => {
    const human = { id: "h1", type: "talent", name: "Minion", flags: { "warhammer-dbc": { minionSlot: { group: "human", tier: "lesser" } } }, system: {} };
    const usage = slotUsage([human], [flagged()], flock());
    expect(usage.free).toHaveLength(0);
    expect(usage.extra).toHaveLength(0);
    expect(groupTally([flagged()], flock())).toEqual({ machine: 1 });
  });
  it("слот по slotTalentId не ломает подбор по паре: слуга без привязки садится как раньше", () => {
    const slot = { id: "t1", type: "talent", name: "Minion", flags: { "warhammer-dbc": { minionSlot: { group: "daemon", tier: "lesser" } } }, system: {} };
    const other = { type: "minion", items: [], system: { minionType: "daemon", minionTier: "lesser", slotTalentId: "gone" } };
    expect(slotUsage([slot], [other], flock()).free).toHaveLength(0);
  });
  it("слот «Машина» занимает человек в латах при Паству", () => {
    const slotTalent = { id: "t1", type: "talent", name: "Minion", flags: { "warhammer-dbc": { minionSlot: { group: "machine", tier: "lesser" } } }, system: {} };
    const m = humanMinion([plate()]); m.system.minionTier = "lesser";
    expect(slotUsage([slotTalent], [m], flock()).free).toHaveLength(0);
    expect(slotUsage([slotTalent], [m]).free).toHaveLength(1);
  });
});
