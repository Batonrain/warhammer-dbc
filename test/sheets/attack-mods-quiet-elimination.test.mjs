// test/sheets/attack-mods-quiet-elimination.test.mjs
//
// Quiet Elimination / Тихое Устранение (wdbc-1rno.3): «+10 к тестам атаки»
// с ножом/игольчатым/осколочным пистолетом — situational-авто-мод в окне
// атаки, независимо от Врасплох (тот пункт — test/combat/
// attack-quiet-elimination.test.mjs, отдельный, per-attack).

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

function quietEliminationTrait() {
  return { id: "t1", type: "trait", name: "Тихое Устранение" };
}

describe("situationalMods: Тихое Устранение — +10 авто-мод по ножу/игольчатому/осколочному пистолету", () => {
  it("есть Трейт и нож в руках — авто-галочка +10 присутствует и отмечена", () => {
    const { commonMods } = situationalMods(baseArgs({
      actor: { items: [quietEliminationTrait()], system: {} },
      weapon: { system: { weaponClass: "melee", meleeCategory: "Нож" } }
    }));
    const mod = commonMods.find(m => m.label.startsWith("Тихое Устранение"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(10);
    expect(mod.autoCheck).toBe(true);
  });

  it("есть Трейт, но оружие не подходит (меч) — мод не добавляется", () => {
    const { commonMods } = situationalMods(baseArgs({
      actor: { items: [quietEliminationTrait()], system: {} },
      weapon: { system: { weaponClass: "melee", meleeCategory: "Меч" } }
    }));
    expect(commonMods.find(m => m.label.startsWith("Тихое Устранение"))).toBeUndefined();
  });

  it("нож в руках, но нет Трейта — мод не добавляется", () => {
    const { commonMods } = situationalMods(baseArgs({
      actor: { items: [], system: {} },
      weapon: { system: { weaponClass: "melee", meleeCategory: "Нож" } }
    }));
    expect(commonMods.find(m => m.label.startsWith("Тихое Устранение"))).toBeUndefined();
  });

  it("осколочный пистолет — тоже подходит (рукопашное поле isMelee не важно для этого мода)", () => {
    const { commonMods } = situationalMods(baseArgs({
      actor: { items: [quietEliminationTrait()], system: {} },
      isMelee: false,
      weapon: { system: { weaponClass: "pistol", weaponType: "splinter" } }
    }));
    expect(commonMods.find(m => m.label.startsWith("Тихое Устранение"))).toBeTruthy();
  });
});
