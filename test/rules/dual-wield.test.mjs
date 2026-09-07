// test/rules/dual-wield.test.mjs
//
// Талант «Two Weapon Wielder / Два Оружия» (wdbc-3jlm): атаки с обеих рук —
// ОДНА атака, занимающая наибольшее действие из двух, обе с −20.
//
// До этой работы пятнадцать Талантов ветки «Два оружия» стояли в реестре
// возможностей с пустым читателем: пара ударов стоила игроку 2 ОД вместо 1
// (и после Натиска второй удар просто упирался в «не хватает ОД»), а штраф и
// скидки к нему игрок держал в голове.
//
// Проверяется арифметика книги: −20 за пару, −20 за неосновную руку, скидки
// по −10 за каждый подходящий Талант, и что они складываются.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { dualWieldMods, dualWieldActionType, canDualWield, offHandCandidates,
         PAIR_PENALTY, OFF_HAND_PENALTY }
  from "../../module/rules/dual-wield.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

/** Персонаж с перечисленными Талантами ветки (возможности из реестра). */
function hero(...caps) {
  clearRuleSources();
  registerRuleSource("test", () => caps.map(c => ({
    id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
  })));
  return { system: {}, items: [] };
}

const w = (weaponClass, meleeCategory = "", id = "w") =>
  ({ id, type: "weapon", system: { weaponClass, meleeCategory, equipped: true } });

const sword  = id => w("melee", "Меч", id);
const knife  = id => w("melee", "Нож", id);
const fists  = id => w("melee", "Кулаки", id);
const pistol = id => w("pistol", "", id);
const thrown = id => w("thrown", "", id);

describe("кто вообще умеет бить двумя руками", () => {
  it("только с Талантом «Два Оружия»", () => {
    expect(canDualWield(hero("dualWield.core.twoWeaponWielder"))).toBe(true);
    expect(canDualWield(hero())).toBe(false);
    // Соседний Талант ветки сам по себе права не даёт.
    expect(canDualWield(hero("dualWield.core.gunslinger"))).toBe(false);
  });
});

describe("штраф парной атаки", () => {
  it("голый Талант: −20 обеим атакам и ещё −20 неосновной руке", () => {
    const m = dualWieldMods(hero("dualWield.core.twoWeaponWielder"), sword("a"), sword("b"));
    expect(m.pair).toBe(PAIR_PENALTY);
    expect(m.offHand).toBe(OFF_HAND_PENALTY);
    expect(m.reductions).toEqual([]);
  });

  it("Амбидекстр снимает штраф неосновной руки целиком и даёт −10 к парному", () => {
    const m = dualWieldMods(hero("dualWield.core.twoWeaponWielder", "dualWield.core.ambidextrous"),
                            sword("a"), sword("b"));
    expect(m.offHand).toBe(0);
    expect(m.pair).toBe(-10);
    expect(m.reductions.map(r => r.label)).toEqual(["Амбидекстр"]);
  });

  it("скидки складываются: Амбидекстр + Македонец на паре пистолетов гасят штраф в ноль", () => {
    const m = dualWieldMods(hero("dualWield.core.twoWeaponWielder", "dualWield.core.ambidextrous",
                                 "dualWield.core.gunslinger"), pistol("a"), pistol("b"));
    expect(m.pair).toBe(0);
    expect(m.offHand).toBe(0);
  });

  it("штраф гасится до нуля, но не переворачивается в бонус", () => {
    // Книга нигде не обещает плюса за парное оружие.
    const m = dualWieldMods(hero("dualWield.core.twoWeaponWielder", "dualWield.core.ambidextrous",
                                 "dualWield.core.gunslinger", "dualWield.core.sideblade"),
                            pistol("a"), pistol("b"));
    expect(m.pair).toBe(0);
  });
});

describe("скидки срабатывают только на своём оружии", () => {
  const has = (caps, a, b) => dualWieldMods(hero(...caps), a, b).reductions.map(r => r.label);

  it("Танцор с Клинками — только пара мечей", () => {
    const caps = ["dualWield.core.twoWeaponWielder", "dualWield.core.bladeDancer"];
    expect(has(caps, sword("a"), sword("b"))).toEqual(["Танцор с Клинками"]);
    expect(has(caps, sword("a"), knife("b"))).toEqual([]);
  });

  it("Македонец — только пара пистолетов", () => {
    const caps = ["dualWield.core.twoWeaponWielder", "dualWield.core.gunslinger"];
    expect(has(caps, pistol("a"), pistol("b"))).toEqual(["Македонец"]);
    expect(has(caps, pistol("a"), sword("b"))).toEqual([]);
  });

  it("Запасной Ствол — пистолет плюс рукопашное, в любом порядке", () => {
    const caps = ["dualWield.core.twoWeaponWielder", "dualWield.core.sidearm"];
    expect(has(caps, pistol("a"), sword("b"))).toEqual(["Запасной Ствол"]);
    expect(has(caps, sword("a"), pistol("b"))).toEqual(["Запасной Ствол"]);
    expect(has(caps, pistol("a"), pistol("b"))).toEqual([]);
  });

  it("Запасной Клинок — достаточно одного ножа", () => {
    const caps = ["dualWield.core.twoWeaponWielder", "dualWield.core.sideblade"];
    expect(has(caps, sword("a"), knife("b"))).toEqual(["Запасной Клинок"]);
    expect(has(caps, knife("a"), sword("b"))).toEqual(["Запасной Клинок"]);
    expect(has(caps, sword("a"), sword("b"))).toEqual([]);
  });

  it("Боксёр — кулаки, Веер Ножей — метательное", () => {
    expect(has(["dualWield.core.brawler"], fists("a"), fists("b"))).toEqual(["Боксёр"]);
    expect(has(["dualWield.core.brawler"], fists("a"), sword("b"))).toEqual([]);
    expect(has(["dualWield.core.fanOfKnives"], thrown("a"), thrown("b"))).toEqual(["Веер Ножей"]);
    expect(has(["dualWield.core.fanOfKnives"], thrown("a"), pistol("b"))).toEqual([]);
  });

  it("Талант, которого у персонажа нет, скидки не даёт", () => {
    expect(has(["dualWield.core.twoWeaponWielder"], pistol("a"), pistol("b"))).toEqual([]);
  });
});

describe("сколько действий занимает парная атака", () => {
  it("наибольшее из двух, а не сумма — в этом весь смысл Таланта", () => {
    expect(dualWieldActionType("Полудействие", "Полудействие")).toBe("Полудействие");
    expect(dualWieldActionType("Полудействие", "Полное действие")).toBe("Полное действие");
    expect(dualWieldActionType("Полное действие", "Полудействие")).toBe("Полное действие");
    expect(dualWieldActionType("Свободное действие", "Полудействие")).toBe("Полудействие");
  });

  it("незнакомое имя действия считается Полудействием, как одиночная атака", () => {
    expect(dualWieldActionType("Ерунда", "Ерунда")).toBe("Полудействие");
    expect(dualWieldActionType(undefined, "Полное действие")).toBe("Полное действие");
  });
});

describe("что предлагать во вторую руку", () => {
  it("надетое оружие, кроме уже выбранного", () => {
    const main = sword("main");
    const actor = { items: [main, knife("off"), { id: "x", type: "armor", system: { equipped: true } },
                            { id: "y", type: "weapon", system: { equipped: false } }] };
    expect(offHandCandidates(actor, main).map(i => i.id)).toEqual(["off"]);
  });

  it("пустой лист не роняет отбор", () => {
    expect(offHandCandidates(null, null)).toEqual([]);
  });
});
