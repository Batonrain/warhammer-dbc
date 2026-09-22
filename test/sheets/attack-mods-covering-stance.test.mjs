// test/sheets/attack-mods-covering-stance.test.mjs
//
// Прикрывающая Стойка (стр. 15, wdbc-x1nz.2.66.7): −20 атакам по союзникам
// персонажа рядом с ним — автогалочка в окне атаки, читает
// module/combat/free-attack.mjs::coveringDefendersOf(targetToken).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";

const FRIENDLY = 1;

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

function token({ id, x = 0, y = 0, width = 2, height = 2, disposition = FRIENDLY, meleeStance = "standard", name = id } = {}) {
  const doc = {
    id, x, y, width, height, disposition, name, uuid: `Scene.s.Token.${id}`,
    actor: { type: "character", system: { meleeStance } }
  };
  return { document: doc };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] }, ready: true };
});

describe("situationalMods: Прикрывающая Стойка — −20 атакам по прикрытому союзнику", () => {
  it("цель прикрыта союзником в Прикрывающей Стойке рядом — автогалочка −20 с именем прикрывающего", () => {
    const targetTok = token({ id: "t", x: 0, y: 0, name: "Цель" });
    const guardTok  = token({ id: "g", x: 2, y: 0, meleeStance: "covering", name: "Щитоносец" });
    canvas.tokens.placeables = [targetTok, guardTok];

    const { specificMods } = situationalMods(baseArgs({ targetToken: targetTok }));
    const mod = specificMods.find(m => m.label.startsWith("Прикрывающая Стойка"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(-20);
    expect(mod.autoCheck).toBe(true);
    expect(mod.note).toContain("Щитоносец");
  });

  it("рядом союзник, но НЕ в Прикрывающей Стойке — галочки нет", () => {
    const targetTok = token({ id: "t", x: 0, y: 0, name: "Цель" });
    const allyTok   = token({ id: "a", x: 2, y: 0, meleeStance: "standard", name: "Союзник" });
    canvas.tokens.placeables = [targetTok, allyTok];

    const { specificMods } = situationalMods(baseArgs({ targetToken: targetTok }));
    expect(specificMods.find(m => m.label.startsWith("Прикрывающая Стойка"))).toBeUndefined();
  });

  it("стрелковая атака (isMelee:false) — галочки нет, даже при соседстве", () => {
    const targetTok = token({ id: "t", x: 0, y: 0, name: "Цель" });
    const guardTok  = token({ id: "g", x: 2, y: 0, meleeStance: "covering", name: "Щитоносец" });
    canvas.tokens.placeables = [targetTok, guardTok];

    const { specificMods } = situationalMods(baseArgs({ isMelee: false, targetToken: targetTok }));
    expect(specificMods.find(m => m.label.startsWith("Прикрывающая Стойка"))).toBeUndefined();
  });

  it("нет наведённой цели — не падает, галочки нет", () => {
    const { specificMods } = situationalMods(baseArgs({ targetToken: null }));
    expect(specificMods.find(m => m.label.startsWith("Прикрывающая Стойка"))).toBeUndefined();
  });
});
