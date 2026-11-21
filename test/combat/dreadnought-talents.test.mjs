// Таланты Дредноутов: Бастион, Мантия Пепла, Пригоршня Грома (остаток Талантов, 20.11.2026).
import { describe, it, expect } from "vitest";
import { bastionMod, bastionResult, ashMantleActive, selfAndPilot, fistfulActive, fistfulBlocks }
  from "../../module/combat/dreadnought-talents.mjs";

const talent = name => ({ type: "talent", name });
const pilot = { uuid: "Actor.p", type: "character", items: [talent("Ash Mantle / Мантия Пепла"), talent("Fistful of Thunder / Пригоршня Грома")] };
const dread = { uuid: "Actor.d", type: "vehicle", items: [], system: { stations: [{ role: "pilot", uuid: "Actor.p" }] } };
const resolve = u => (u === "Actor.p" ? pilot : null);

describe("Бастион", () => {
  it("−10 за каждый Размер тарана выше своего, меньший таран — без штрафа", () => {
    expect(bastionMod(6, 8)).toBe(-20);
    expect(bastionMod(8, 6)).toBe(-0);
  });
  it("Успех — без урона, 3+ — ещё и ответная атака", () => {
    expect(bastionResult(false, 4)).toBe(0);
    expect(bastionResult(true, 2)).toBe(1);
    expect(bastionResult(true, 3)).toBe(2);
  });
});

describe("Таланты на пилоте", () => {
  it("машина находит пилота по месту экипажа", () => {
    expect(selfAndPilot(dread, resolve)).toEqual([dread, pilot]);
    expect(ashMantleActive(dread, resolve)).toBe(true);
    expect(fistfulActive(dread, resolve)).toBe(true);
    expect(ashMantleActive({ type: "vehicle", items: [], system: { stations: [] } }, resolve)).toBe(false);
  });
});

describe("Пригоршня Грома: метка", () => {
  const flagged = f => ({ uuid: "Actor.d", getFlag: () => f });
  const target = { uuid: "Actor.t" };
  it("та же цель в тот же Ход — без Избеганий", () => {
    const c = { id: "c", round: 2, turn: 0 };
    expect(fistfulBlocks(flagged({ targetUuid: "Actor.t", combatId: "c", round: 2, turn: 0 }), target, c)).toBe(true);
    expect(fistfulBlocks(flagged({ targetUuid: "Actor.t", combatId: "c", round: 2, turn: 0 }), { uuid: "Actor.x" }, c)).toBe(false);
    expect(fistfulBlocks(flagged({ targetUuid: "Actor.t", combatId: "c", round: 1, turn: 0 }), target, c)).toBe(false);
  });
  it("вне боя — метка без Хода", () => {
    expect(fistfulBlocks(flagged({ targetUuid: "Actor.t" }), target, null)).toBe(true);
  });
});
