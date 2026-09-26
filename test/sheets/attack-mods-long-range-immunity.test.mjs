// test/sheets/attack-mods-long-range-immunity.test.mjs
//
// wdbc-1rno.31: штраф дальней (−10) и экстремальной (−30) дистанции уже
// ставится окном атаки сам; здесь — кто его снимает: Снайпер, Холодные Глаза,
// Оптический/Джинн-Прицел при Прицеливании.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";
import { longRangeImmunityReason } from "../../module/rules/range-penalty-immunity.mjs";

const weapon = { id: "w1", system: { weaponClass: "basic" } };
const scope = name => ({ id: "m1", type: "weaponMod", name, system: { installedOn: "w1" } });
const talent = name => ({ id: "t1", type: "talent", name, system: {} });
const actorWith = (items, aiming = "none") => {
  const list = [...items];
  return { items: list, system: { aiming } };
};

function rows(actor) {
  const { specificMods } = situationalMods({
    actor, attackCtx: {}, attackerToken: null, gripRange: null, hasFatigue: false,
    hasLostEyes: false, isBlinded: false, isMelee: false, measured: null,
    targetHelpless: false, targetToken: null, weapon, wProps: [], wp: {}
  });
  return {
    long: specificMods.find(m => m.label === "Дальняя дистанция"),
    extreme: specificMods.find(m => m.label === "Экстремальная дистанция")
  };
}

describe("гасители штрафа дальней/экстремальной дистанции", () => {
  it("без гасителей штрафы на месте", () => {
    const { long, extreme } = rows(actorWith([]));
    expect(long.value).toBe(-10);
    expect(extreme.value).toBe(-30);
  });

  it("Талант Снайпер снимает оба", () => {
    const { long, extreme } = rows(actorWith([talent("Marksman / Снайпер")]));
    expect(long).toEqual(expect.objectContaining({ value: 0, immune: true }));
    expect(extreme).toEqual(expect.objectContaining({ value: 0, immune: true }));
    expect(long.note).toMatch(/Снайпер/);
  });

  it("Оптический Прицел — только при Прицеливании", () => {
    const opt = scope("Optical Sight / Оптический Прицел");
    expect(rows(actorWith([opt], "none")).long.value).toBe(-10);
    expect(rows(actorWith([opt], "half")).long.value).toBe(0);
  });

  it("прицел, стоящий на другом стволе, не считается", () => {
    const other = { ...scope("Djinn Sight / Джинн-Прицел"), system: { installedOn: "w2" } };
    expect(longRangeImmunityReason(actorWith([other], "full"), [], { aiming: "full" })).toBeNull();
  });
});

// wdbc-1rno.3.1: Состояние «Врасплох» цели в 1-м Раунде — галочка +30 сама.
describe("Цель в Состоянии Врасплох (стр. 12)", () => {
  const surprisedRow = (round, surprised = true) => {
    const prev = game.combat;
    game.combat = round ? { round } : null;
    try {
      const { commonMods } = situationalMods({
        actor: actorWith([]), attackCtx: { targetActor: { system: { conditions: { surprised } } } },
        attackerToken: null, gripRange: null, hasFatigue: false, hasLostEyes: false, isBlinded: false,
        isMelee: true, measured: null, targetHelpless: false, targetToken: null, weapon: null, wProps: [], wp: {}
      });
      return commonMods.find(m => m.id === "atk-mod-surprised");
    } finally { game.combat = prev; }
  };

  it("1-й Раунд — отмечена сама", () => {
    expect(surprisedRow(1).autoCheck).toBe(true);
  });

  it("2-й Раунд, вне боя или цель не Врасплох — ручная", () => {
    expect(surprisedRow(2).autoCheck).toBe(false);
    expect(surprisedRow(null).autoCheck).toBe(false);
    expect(surprisedRow(1, false).autoCheck).toBe(false);
  });
});

// wdbc-1rno.36: гасители штрафов плохой видимости со стороны атакующего.
describe("Ночное Зрение, Охотничий Визор, Термальный и Джинн-Прицел", () => {
  const vision = actor => {
    const { commonMods } = situationalMods({
      actor, attackCtx: {}, attackerToken: null, gripRange: null, hasFatigue: false,
      hasLostEyes: false, isBlinded: false, isMelee: false, measured: null,
      targetHelpless: false, targetToken: null, weapon, wProps: [], wp: {}
    });
    const row = label => commonMods.find(m => m.label === label);
    return { dim: row("Слабый свет"), smoke: row("Дым / туман"), dark: row("Тьма") };
  };
  const trait = name => ({ id: "t", type: "trait", name, system: {} });

  it("Ночное Зрение гасит Слабый свет и Тьму, но не дым", () => {
    const r = vision(actorWith([trait("Dark Sight / Ночное Зрение")]));
    expect(r.dim.value).toBe(0);
    expect(r.dark.value).toBe(0);
    expect(r.smoke.value).toBe(-20);
  });

  it("Охотничий Визор — только надетый", () => {
    const visor = on => ({ id: "v", type: "gear", name: "Preysense Visor / Охотничий Визор", system: { equipped: on } });
    expect(vision(actorWith([visor(true)])).dark.value).toBe(0);
    expect(vision(actorWith([visor(false)])).dark.value).toBe(-30);
  });

  it("Термальный Прицел гасит свет, Джинн — дым; оба только при Прицеливании", () => {
    const thermal = scope("Thermal Sight / Термальный Прицел");
    const djinn = { ...scope("Djinn Sight / Джинн-Прицел"), id: "m2" };
    expect(vision(actorWith([thermal], "none")).dark.value).toBe(-30);
    expect(vision(actorWith([thermal], "half")).dark.value).toBe(0);
    expect(vision(actorWith([djinn], "half")).smoke.value).toBe(0);
    expect(vision(actorWith([djinn], "half")).dark.value).toBe(-30);
  });
});

// wdbc-1rno.29: Прицел на Упреждение и Предсказатель Движения снимают −10 Низкой высоты.
describe("Низкая высота цели: гасители", () => {
  const low = actor => situationalMods({
    actor, attackCtx: {}, attackerToken: null, gripRange: null, hasFatigue: false,
    hasLostEyes: false, isBlinded: false, isMelee: false, measured: null,
    targetHelpless: false, targetToken: null, weapon, wProps: [], wp: {}
  }).specificMods.find(m => m.label === "Низкая высота цели");

  it("без гасителей −10", () => expect(low(actorWith([])).value).toBe(-10));

  it("успешный Прицел на Упреждение снимает", () => {
    const a = { ...actorWith([]), flags: { "warhammer-dbc": { trackingAimActive: true } } };
    expect(low(a)).toEqual(expect.objectContaining({ value: 0, immune: true }));
  });

  it("Предсказатель Движения — только при Прицеливании", () => {
    const mp = { ...scope("Motion Predictor / Предсказатель Движения"), system: { installedOn: "w1", effects: { aimIgnoresRunning: true } } };
    expect(low(actorWith([mp], "none")).value).toBe(-10);
    expect(low(actorWith([mp], "full")).value).toBe(0);
  });
});

// wdbc-1rno.24: Антиприцел — прицельная атака по носителю автоматически промахивается.
describe("Антиприцел цели", () => {
  const antiAimTarget = { items: [{ type: "mutation", name: "Strange Invulnerability", system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "attack.antiAim", label: "" }] }] } } }], system: {} };
  const row = aiming => situationalMods({
    actor: actorWith([], aiming), attackCtx: { targetActor: antiAimTarget }, attackerToken: null, gripRange: null,
    hasFatigue: false, hasLostEyes: false, isBlinded: false, isMelee: false, measured: null,
    targetHelpless: false, targetToken: null, weapon, wProps: [], wp: {}
  }).commonMods.find(m => m.label === "Антиприцел цели");

  it("прицелился — автопровал отмечен сам", () => {
    expect(row("half")).toEqual(expect.objectContaining({ autofail: true, autoCheck: true }));
  });
  it("без Прицеливания — строка есть, но не отмечена", () => {
    expect(row("none").autoCheck).toBe(false);
  });
});

// wdbc-1rno.3.1 (решение владельца 26.09): «Скрытая атака» — только «Избегание
// невозможно», без +30; +30 даёт «Цель Врасплох».
describe("Скрытая атака без +30", () => {
  it("строка есть, но числа не даёт", () => {
    const { commonMods } = situationalMods({
      actor: actorWith([]), attackCtx: {}, attackerToken: null, gripRange: null, hasFatigue: false,
      hasLostEyes: false, isBlinded: false, isMelee: true, measured: null, targetHelpless: false,
      targetToken: null, weapon: null, wProps: [], wp: {}
    });
    expect(commonMods.find(m => m.id === "atk-mod-hidden").value).toBe(0);
  });
});
