// test/sheets/attack-mods-legacy-slaughter.test.mjs
//
// Наследие Бойни/H1 (стр. 426), стрелковая ветка (wdbc-1rno.35): «+20 на
// следующую атаку этим оружием после убийства им» — situational-авто-мод в
// окне атаки, тем же приёмом, что Наследие Ярости. Рукопашная ветка (включая
// −30 на Оглушить) — отдельно, в sheets/attack/selection.mjs::maneuverBon
// (не через этот файл, там нет Приёмов).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";

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

function slaughterActor(weaponId = "w1") {
  const flags = { legacySlaughterBonus: { weaponId } };
  return { items: [], system: {}, getFlag: (_s, k) => flags[k] };
}

const slaughterWeapon = (id = "w1") =>
  ({ id, system: { weaponClass: "basic", legacy: { historyName: "Наследие Бойни" } } });

describe("situationalMods: Наследие Бойни — +20 авто-мод этим оружием (стрелковая)", () => {
  it("флаг заряжен этим оружием — авто-галочка +20 присутствует и отмечена", () => {
    const actor = slaughterActor("w1");
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: slaughterWeapon("w1") }));
    const mod = commonMods.find(m => m.label.startsWith("Наследие Бойни"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(20);
    expect(mod.autoCheck).toBe(true);
  });

  it("флаг от ДРУГОГО оружия — мод не добавляется", () => {
    const actor = slaughterActor("w-other");
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: slaughterWeapon("w1") }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Бойни"))).toBeUndefined();
  });

  it("нет флага вовсе — мод не добавляется", () => {
    const actor = { items: [], system: {}, getFlag: () => undefined };
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: slaughterWeapon("w1") }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Бойни"))).toBeUndefined();
  });

  it("рукопашная атака — мод НЕ добавляется здесь (та ветка в selection.mjs, иначе задвоение)", () => {
    const actor = slaughterActor("w1");
    const { commonMods } = situationalMods(baseArgs({ actor, weapon: slaughterWeapon("w1"), isMelee: true }));
    expect(commonMods.find(m => m.label.startsWith("Наследие Бойни"))).toBeUndefined();
  });
});
