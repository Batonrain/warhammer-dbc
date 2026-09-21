// test/sheets/attack-mods-legacy-patience.test.mjs
//
// Терпение/vigilant 3-4, Оружие Наследия (wdbc-1rno.35/wdbc-1rno.41, стр.
// 427-428): situational-авто-моды в окне атаки — стрелковая половина
// (+30 на выстрел из Караула, заряжен combat/overwatch.mjs) и рукопашная
// (+30 атака Задержкой по идущему в Натиск противника).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";

beforeEach(() => { globalThis.game.combat = undefined; });

function baseArgs(overrides = {}) {
  return {
    actor: { items: [], system: {}, getFlag: () => undefined },
    attackCtx: {},
    attackerToken: null,
    gripRange: null,
    hasFatigue: false,
    hasLostEyes: false,
    isBlinded: false,
    isMelee: false,
    measured: null,
    targetHelpless: false,
    targetToken: null,
    weapon: null,
    wProps: [],
    wp: {},
    ...overrides
  };
}

const patienceWeapon = (id = "w1", cls = "basic") =>
  ({ id, system: { weaponClass: cls, legacy: { active: true, mutations: [{ name: "Терпение" }] } } });

describe("situationalMods: Терпение — стрелковая половина (Караул)", () => {
  function pendingActor() {
    const flags = { legacyPatienceOverwatchPending: true };
    return { items: [], system: {}, getFlag: (_s, k) => flags[k] };
  }

  it("флаг заряжен — авто-галочка +30 присутствует и отмечена", () => {
    const actor = pendingActor();
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: patienceWeapon() }));
    const mod = commonMods.find(m => m.label.startsWith("Терпение") && m.label.includes("Караул"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(30);
    expect(mod.autoCheck).toBe(true);
  });

  it("нет заряда — мод не добавляется", () => {
    const actor = { items: [], system: {}, getFlag: () => undefined };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: patienceWeapon() }));
    expect(commonMods.find(m => m.label.startsWith("Терпение"))).toBeUndefined();
  });

  it("рукопашная атака — стрелковая ветка не добавляется здесь", () => {
    const actor = pendingActor();
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: patienceWeapon("w1", "melee"), isMelee: true }));
    expect(commonMods.find(m => m.label.includes("Караул"))).toBeUndefined();
  });
});

describe("situationalMods: Терпение — рукопашная половина (атака Задержкой по Натиску, wdbc-1rno.41)", () => {
  function meleeArgs({ ap = 1, meleeBase = "charge", ownTurn = false } = {}) {
    const actor = { items: [], system: { actionPoints: { value: ap } }, getFlag: () => undefined };
    if (ownTurn) globalThis.game.combat = { combatant: { actor } };
    const targetActor = { system: { meleeBase } };
    return baseArgs({ actor, weapon: patienceWeapon("w1", "melee"), isMelee: true, attackCtx: { targetActor } });
  }

  it("1 ОД (Задержка), цель в Натиске, не свой Ход — авто-галочка +30", () => {
    const { commonMods } = situationalMods(meleeArgs({}));
    const mod = commonMods.find(m => m.label.includes("Задержкой"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(30);
    expect(mod.autoCheck).toBe(true);
  });

  it("2 ОД (не Задержка) — мод не добавляется", () => {
    const { commonMods } = situationalMods(meleeArgs({ ap: 2 }));
    expect(commonMods.find(m => m.label.includes("Задержкой"))).toBeUndefined();
  });

  it("цель не в Натиске — мод не добавляется", () => {
    const { commonMods } = situationalMods(meleeArgs({ meleeBase: "standard" }));
    expect(commonMods.find(m => m.label.includes("Задержкой"))).toBeUndefined();
  });

  it("свой Ход — мод не добавляется (Задержка тратится ВНЕ своего Хода)", () => {
    const { commonMods } = situationalMods(meleeArgs({ ownTurn: true }));
    expect(commonMods.find(m => m.label.includes("Задержкой"))).toBeUndefined();
  });

  it("стрелковая атака — рукопашная ветка не добавляется здесь", () => {
    const actor = { items: [], system: { actionPoints: { value: 1 } }, getFlag: () => undefined };
    const targetActor = { system: { meleeBase: "charge" } };
    const { commonMods } = situationalMods(baseArgs({
      actor, weapon: patienceWeapon("w1", "basic"), isMelee: false, attackCtx: { targetActor }
    }));
    expect(commonMods.find(m => m.label.includes("Задержкой"))).toBeUndefined();
  });
});
