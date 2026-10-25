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
         isServitorOrRobot, effectiveMinionGroup, isFlockEligibleHuman }
  from "../../module/rules/binary-dominion.mjs";
import { commandSubstitutionRules } from "../../module/rules/command-substitution.mjs";
import { groupTally, minionCapacity, slotUsage } from "../../module/rules/minion-build.mjs";

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
  it("слот «Машина» занимает человек в латах при Паству", () => {
    const slotTalent = { id: "t1", type: "talent", name: "Minion", flags: { "warhammer-dbc": { minionSlot: { group: "machine", tier: "lesser" } } }, system: {} };
    const m = humanMinion([plate()]); m.system.minionTier = "lesser";
    expect(slotUsage([slotTalent], [m], flock()).free).toHaveLength(0);
    expect(slotUsage([slotTalent], [m]).free).toHaveLength(1);
  });
});
