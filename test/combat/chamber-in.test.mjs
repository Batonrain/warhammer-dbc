// test/combat/chamber-in.test.mjs
//
// Chamber In / Досылание (Стрелок; Sahara 3-5fbf, решение владельца
// 24.10.2026: «+1 патрон в магазин», запас магазинов не уменьшается): «Когда он
// держит винтовку или длинную винтовку двумя руками или вооружен пистолетом и
// имеет свободную руку, он может раз в Ход свободным действием зарядить в это
// оружие один патрон, но только со своего бандольера или пояса. Этот Талант не
// работает с оружием, что заряжается топливом или батареями».

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { weaponFor, actorFor } from "../support/combat-fixtures.mjs";
import { chamberInRound } from "../../module/combat/reload.mjs";
import { chamberInAvailable, chamberInBlockReason } from "../../module/rules/gunner-talents.mjs";

const CHAMBER = { key: "rangedCore.core.chamberIn", name: "Chamber In / Досылание" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

function setup({ cls = "basic", weaponType = "bolt", mag = 3, max = 10, items = [byName(CHAMBER.name)], grips = cls === "pistol" ? "1р" : "2р" } = {}) {
  const weapon = weaponFor({ weaponClass: cls, weaponType, magazineCur: mag, magazineMax: max, equipped: true, grips }, { id: "w1", name: "Болтер" });
  const ammo = { id: "a1", name: "Боеприпас", type: "ammo", system: { quantity: 4 }, getFlag: () => undefined, update: async () => {} };
  const actor = actorFor({ items: [weapon, ammo, ...items], fatigue: { value: 0 } });
  const flags = {};
  actor.getFlag = (s, k) => flags[`${s}.${k}`];
  actor.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
  actor.flags = flags;
  return { actor, weapon, ammo };
}

beforeEach(() => resetCaptured());
afterEach(() => resetCaptured());

describe("Досылание: +1 патрон в магазин, запас не уменьшается", () => {
  it("винтовка в двух руках (ключ): 3 → 4, запас 4 → 4, раз в Ход помечено", async () => {
    const { actor, weapon, ammo } = setup({ items: [byKey(CHAMBER.key)] });
    expect(await chamberInRound(actor, weapon)).toBe(true);
    expect(weapon.system.magazineCur).toBe(4);
    expect(ammo.system.quantity).toBe(4);
    expect(actor.flags["warhammer-dbc.chamberInThisTurn"]).toBe(true);
    expect(captured.chat.at(-1)?.content).toContain("Досылание");
  });

  it("по имени: то же; второй раз в Ход — отказ, магазин не растёт", async () => {
    const { actor, weapon } = setup();
    expect(await chamberInRound(actor, weapon)).toBe(true);
    expect(await chamberInRound(actor, weapon)).toBe(false);
    expect(weapon.system.magazineCur).toBe(4);
  });

  it("пистолет при свободной руке — можно", async () => {
    const { actor, weapon } = setup({ cls: "pistol" });
    expect(await chamberInRound(actor, weapon)).toBe(true);
    expect(weapon.system.magazineCur).toBe(4);
  });

  it("без Таланта — нельзя", async () => {
    const { actor, weapon } = setup({ items: [] });
    expect(await chamberInRound(actor, weapon)).toBe(false);
    expect(weapon.system.magazineCur).toBe(3);
  });

  it("лазерное (батареи), плазма и огнемёт (топливо) — нельзя", async () => {
    for (const weaponType of ["laser", "plasma", "flame", "melta"]) {
      const { actor, weapon } = setup({ weaponType });
      expect(await chamberInRound(actor, weapon)).toBe(false);
      expect(weapon.system.magazineCur).toBe(3);
    }
  });

  it("на оружии стоит Буллпап — отказ", async () => {
    const { actor, weapon } = setup();
    actor.items.push({ id: "m1", type: "weaponMod", name: "Bullpup / Буллпап", system: { installedOn: "w1" } });
    expect(await chamberInRound(actor, weapon)).toBe(false);
    expect(weapon.system.magazineCur).toBe(3);
  });

  it("магазин полон — отказ", async () => {
    const { actor, weapon } = setup({ mag: 10 });
    expect(await chamberInRound(actor, weapon)).toBe(false);
    expect(weapon.system.magazineCur).toBe(10);
  });
});

describe("условия (чистые функции)", () => {
  const w = cls => ({ type: "weapon", system: { weaponClass: cls, weaponType: "bolt" } });
  const base = { handsNeeded: 2, freeHands: 0, usedThisTurn: false, magazineCur: 3, magazineMax: 10 };

  it("винтовка — только двумя руками; пистолет — только со свободной рукой", () => {
    expect(chamberInBlockReason(w("basic"), base)).toBe("");
    expect(chamberInBlockReason(w("basic"), { ...base, handsNeeded: 1 })).toContain("двумя руками");
    expect(chamberInBlockReason(w("pistol"), { ...base, handsNeeded: 1, freeHands: 1 })).toBe("");
    expect(chamberInBlockReason(w("pistol"), { ...base, handsNeeded: 1, freeHands: 0 })).toContain("свободная рука");
  });

  it("мод Буллпап запрещает Досылание (описание мода: «Chamber In… не работают»)", () => {
    expect(chamberInBlockReason(w("basic"), { ...base, modBlocked: true })).toContain("Буллпап");
  });

  it("раз в Ход и полный магазин", () => {
    expect(chamberInBlockReason(w("basic"), { ...base, usedThisTurn: true })).toContain("в этом Ходу");
    expect(chamberInBlockReason(w("basic"), { ...base, magazineCur: 10 })).toContain("полон");
    expect(chamberInBlockReason(w("basic"), { ...base, magazineMax: 0 })).toContain("полон");
  });

  it("доступность: тяжёлое и рукопашное не подходят", () => {
    const a = actorFor({ items: [byName(CHAMBER.name)] });
    expect(chamberInAvailable(a, w("basic"))).toBe(true);
    expect(chamberInAvailable(a, w("heavy"))).toBe(false);
    expect(chamberInAvailable(a, w("melee"))).toBe(false);
    expect(chamberInAvailable(actorFor({ items: [] }), w("basic"))).toBe(false);
  });
});
