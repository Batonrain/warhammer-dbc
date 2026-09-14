import { describe, it, expect, afterEach } from "vitest";
import { HOMEWORLD_BY_KEY } from "../../module/constants/homeworlds.mjs";
import { getRuleSources } from "../../module/rules/sources.mjs";

const RULE = { id: "test.homeworld" };

const source = key => getRuleSources().find(([k]) => k === key)[1];
const actorWith = key => ({ system: {}, items: [{ type: "homeworld", system: { key } }] });

afterEach(() => {
  delete globalThis.game;
  delete HOMEWORLD_BY_KEY.__test;
});

describe("источник homeworld", () => {
  it("ключ Происхождения берётся с предмета-носителя", () => {
    HOMEWORLD_BY_KEY.__test = { rules: [RULE] };
    expect(source("homeworld")(actorWith("__test"))).toEqual([RULE]);
  });

  it("Происхождения у актора нет — источник пуст", () => {
    expect(source("homeworld")({ system: {}, items: [] })).toEqual([]);
  });

  // Выключатель подсистемы должен убирать правила из сборки. Иначе повторится
  // течь, найденная на шаге 1.4 плана: галочки Особенностей из диалога исчезали,
  // а расчёт продолжал их учитывать.
  it("подсистема «Происхождения» выключена — источник пуст", () => {
    HOMEWORLD_BY_KEY.__test = { rules: [RULE] };
    globalThis.game = { ...globalThis.game, settings: { get: () => false } };
    expect(source("homeworld")(actorWith("__test"))).toEqual([]);
  });
});

// Уравнитель/The Equalizer (wdbc-1rno) — юнит-покрытие самой функции в
// test/rules/opposed-target-reroll.test.mjs, здесь только факт регистрации
// источника под правильным ключом и то, что реестр реально его зовёт.
describe("источник opposedTarget (Уравнитель, wdbc-1rno)", () => {
  const char = total => ({ total, bonus: Math.floor(total / 10) });
  const equalizerHolder = ws => ({
    system: { characteristics: { ws: char(ws) } },
    items: [{ name: "The Equalizer", flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
      { id: "eq1", kind: "reroll", rerollScope: "attack", rerollMode: "keepWorst", rerollWho: "opponent" }
    ] }] } } }]
  });

  it("зарегистрирован", () => {
    expect(getRuleSources().some(([k]) => k === "opposedTarget")).toBe(true);
  });

  it("вызывается с (actor, ctx) и достаёт правило с targetActor", () => {
    const attacker = { system: { characteristics: { ws: char(55) } } };
    const rules = source("opposedTarget")(attacker, { targetActor: equalizerHolder(40), char: "ws" });
    expect(rules).toHaveLength(1);
  });
});

// Психосилы, дающие способность цели каста (wdbc-lmd2, найдено внутри
// wdbc-q0q8) — Dragon Scales/Wings of the Phoenix. Соглашение "target:<флаг>"
// разобрано в шапке module/rules/psychic-sustain-target.mjs.
describe("источник psychicSustainTarget (wdbc-lmd2)", () => {
  const targetCapEntry = (id, flag) =>
    ({ id, kind: "capability", capabilityKey: `target:${flag}` });
  const casterWith = (items) => ({ uuid: "Actor.caster", items });
  const power = (id, { isSustained = true, sustainedTargetUuid = "Actor.me", entries = [] } = {}) => ({
    id, uuid: `Item.${id}`, name: "Тестовая психосила", type: "psychicPower",
    system: { isSustained, sustainedTargetUuid },
    flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries }] } }
  });

  afterEach(() => { delete globalThis.game; });

  it("зарегистрирован", () => {
    expect(getRuleSources().some(([k]) => k === "psychicSustainTarget")).toBe(true);
  });

  it("вне игры (нет game.actors) — источник пуст", () => {
    expect(source("psychicSustainTarget")({ uuid: "Actor.me" })).toEqual([]);
  });

  it("чужая поддерживаемая сила с target:-записью, нацеленная на меня — даёт правило", () => {
    globalThis.game = { actors: [casterWith([
      power("p1", { entries: [targetCapEntry("e1", "damageImmunity.subtype.flame")] })
    ])] };
    const rules = source("psychicSustainTarget")({ uuid: "Actor.me" });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([{ kind: "grantFlag", target: "damageImmunity.subtype.flame" }]);
  });

  it("не поддерживается (isSustained:false) — правило не приходит", () => {
    globalThis.game = { actors: [casterWith([
      power("p1", { isSustained: false, entries: [targetCapEntry("e1", "damageImmunity.subtype.flame")] })
    ])] };
    expect(source("psychicSustainTarget")({ uuid: "Actor.me" })).toEqual([]);
  });

  it("цель — другой актор — правило мне не приходит", () => {
    globalThis.game = { actors: [casterWith([
      power("p1", { sustainedTargetUuid: "Actor.other", entries: [targetCapEntry("e1", "damageImmunity.subtype.flame")] })
    ])] };
    expect(source("psychicSustainTarget")({ uuid: "Actor.me" })).toEqual([]);
  });

  it("обычная (не target:) capability-запись той же силы — не даёт правило цели", () => {
    globalThis.game = { actors: [casterWith([
      power("p1", { entries: [{ id: "e1", kind: "capability", capabilityKey: "mutation.someOwnerFlag" }] })
    ])] };
    expect(source("psychicSustainTarget")({ uuid: "Actor.me" })).toEqual([]);
  });

  it("target:-запись внутри вложенной подгруппы тоже находится", () => {
    globalThis.game = { actors: [casterWith([
      power("p1", { entries: [
        { id: "g2", kind: "group", group: { id: "g2i", operator: "AND",
          entries: [targetCapEntry("e1", "weaponPropertyImmunity.flame")] } }
      ] })
    ])] };
    const rules = source("psychicSustainTarget")({ uuid: "Actor.me" });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([{ kind: "grantFlag", target: "weaponPropertyImmunity.flame" }]);
  });

  it("несколько target:-записей у одной силы — все приходят", () => {
    globalThis.game = { actors: [casterWith([
      power("p1", { entries: [
        targetCapEntry("e1", "damageImmunity.subtype.flame"),
        targetCapEntry("e2", "weaponPropertyImmunity.flame")
      ] })
    ])] };
    expect(source("psychicSustainTarget")({ uuid: "Actor.me" })).toHaveLength(2);
  });
});

describe("источник daemonInevitability (Локус Неизбежности, wdbc-smc)", () => {
  const actorWithFlag = value => ({ getFlag: (ns, key) => (key === "inevitabilityPenalty" ? value : undefined) });

  it("флаг не стоит — источник пуст", () => {
    expect(source("daemonInevitability")(actorWithFlag(undefined))).toEqual([]);
  });

  it("флаг стоит — штраф −10 target:all", () => {
    const rules = source("daemonInevitability")(actorWithFlag(true));
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "all", value: -10, label: "Локус Неизбежности: штраф после авто-попадания" }
    ]);
  });
});
