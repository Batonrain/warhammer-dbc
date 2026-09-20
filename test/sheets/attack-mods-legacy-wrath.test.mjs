// test/sheets/attack-mods-legacy-wrath.test.mjs
//
// Наследие Ярости/Rage, Оружие Наследия, рукопашная ветка (wdbc-1rno.35,
// стр. 427): «+10 к атакам ЭТИМ оружием» — situational-авто-мод в окне
// атаки, тем же приёмом, что Тихое Устранение.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";

function baseArgs(overrides = {}) {
  return {
    actor: { items: [], system: {} },
    attackCtx: {},
    attackerToken: null,
    gripRange: null,
    hasFatigue: false,
    hasLostEyes: false,
    isBlinded: false,
    isMelee: true,
    measured: null,
    targetHelpless: false,
    targetToken: null,
    weapon: null,
    wProps: [],
    wp: {},
    ...overrides
  };
}

const rageWeapon = () => ({ system: { weaponClass: "melee", legacy: { historyName: "Наследие Ярости" } } });

describe("situationalMods: Наследие Ярости — +10 авто-мод этим оружием (рукопашная)", () => {
  it("оружие несёт Историю — авто-галочка +10 присутствует и отмечена", () => {
    const { commonMods } = situationalMods(baseArgs({ weapon: rageWeapon() }));
    const mod = commonMods.find(m => m.label.startsWith("Наследие Ярости"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(10);
    expect(mod.autoCheck).toBe(true);
  });

  it("другая История — мод не добавляется", () => {
    const w = { system: { weaponClass: "melee", legacy: { historyName: "Наследие Бойни" } } };
    const { commonMods } = situationalMods(baseArgs({ weapon: w }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Ярости"))).toBeUndefined();
  });

  it("стрелковая атака (ranged-ветка Истории — другой книжный текст) — мод не добавляется", () => {
    const { commonMods } = situationalMods(baseArgs({ weapon: rageWeapon(), isMelee: false }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Ярости"))).toBeUndefined();
  });

  it("без оружия в диалоге — мод не добавляется", () => {
    const { commonMods } = situationalMods(baseArgs({ weapon: null }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Ярости"))).toBeUndefined();
  });
});

const bloodWeapon = () => ({ system: { weaponClass: "basic", legacy: { historyName: "Наследие Крови" } } });

describe("situationalMods: Наследие Крови — +10 по Псайкеру", () => {
  it("цель Псайкер — авто-галочка +10", () => {
    const { commonMods } = situationalMods(baseArgs({
      weapon: bloodWeapon(), attackCtx: { targetActor: { system: { isPsyker: true } } }
    }));
    const mod = commonMods.find(m => m.label.startsWith("Наследие Крови"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(10);
    expect(mod.autoCheck).toBe(true);
  });

  it("цель не Псайкер — мод не добавляется", () => {
    const { commonMods } = situationalMods(baseArgs({
      weapon: bloodWeapon(), attackCtx: { targetActor: { system: { isPsyker: false } } }
    }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Крови"))).toBeUndefined();
  });

  it("другая История — мод не добавляется даже по Псайкеру", () => {
    const w = { system: { weaponClass: "basic", legacy: { historyName: "Наследие Бойни" } } };
    const { commonMods } = situationalMods(baseArgs({
      weapon: w, attackCtx: { targetActor: { system: { isPsyker: true } } }
    }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Крови"))).toBeUndefined();
  });
});

describe("situationalMods: Единство/versatile 3-4 — +5 этим оружием (безусловно)", () => {
  it("оружие с Мутацией — авто-галочка +5", () => {
    const w = { system: { weaponClass: "melee", legacy: { mutations: [{ name: "Единство" }] } } };
    const { commonMods } = situationalMods(baseArgs({ weapon: w }));
    const mod = commonMods.find(m => m.label.startsWith("Единство"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(5);
    expect(mod.autoCheck).toBe(true);
  });

  it("другая Мутация — мод не добавляется", () => {
    const w = { system: { weaponClass: "melee", legacy: { mutations: [{ name: "Рваное" }] } } };
    const { commonMods } = situationalMods(baseArgs({ weapon: w }));
    expect(commonMods.find(m => m.label.startsWith("Единство"))).toBeUndefined();
  });
});

describe("situationalMods: Наследие Перемен — бонус теста от броска Хода", () => {
  const rageChangeWeapon = () => ({ id: "cw1", system: { weaponClass: "basic", legacy: { historyName: "Наследие Перемен" } } });

  it("флаг про это оружие — авто-галочка с числом из флага", () => {
    const actor = { items: [], system: {}, getFlag: () => ({ weaponId: "cw1", testBonus: 6, damageBonus: 0 }) };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: rageChangeWeapon() }));
    const mod = commonMods.find(m => m.label.startsWith("Наследие Перемен"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(6);
    expect(mod.autoCheck).toBe(true);
  });

  it("дубль (testBonus 0) — мод не показывается (нечего подтверждать)", () => {
    const actor = { items: [], system: {}, getFlag: () => ({ weaponId: "cw1", testBonus: 0, damageBonus: 5 }) };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: rageChangeWeapon() }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Перемен"))).toBeUndefined();
  });

  it("флаг про другое оружие — мод не добавляется", () => {
    const actor = { items: [], system: {}, getFlag: () => ({ weaponId: "other", testBonus: 6, damageBonus: 0 }) };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: rageChangeWeapon() }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Перемен"))).toBeUndefined();
  });
});

describe("situationalMods: Кровожадное/fearsome 1-2 — +20 рукопашная (совершал Натиск)", () => {
  const chargeMeleeWeapon = () => ({ system: { weaponClass: "melee", legacy: { mutations: [{ name: "Кровожадное" }] } } });

  it("actor.system.meleeBase==='charge' — авто-галочка +20", () => {
    const actor = { items: [], system: { meleeBase: "charge" } };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: chargeMeleeWeapon() }));
    const mod = commonMods.find(m => m.label.startsWith("Кровожадное") && m.label.includes("Натиск"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(20);
  });

  it("не совершал Натиск — мод не добавляется", () => {
    const actor = { items: [], system: { meleeBase: "standard" } };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: chargeMeleeWeapon() }));
    expect(commonMods.find(m => m.label.startsWith("Кровожадное") && m.label.includes("Натиск"))).toBeUndefined();
  });
});
