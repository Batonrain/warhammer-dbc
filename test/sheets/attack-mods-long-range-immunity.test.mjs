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
