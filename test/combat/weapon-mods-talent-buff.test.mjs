// test/combat/weapon-mods-talent-buff.test.mjs
//
// wdbc-g53k: Таланты получили ту же форму effects.weaponBuff, что уже несут
// психосилы (module/combat/weapon-mods.mjs::getModEffects) — многие боевые
// Таланты («+X Dmg», «+X Pen») не имели вообще никакого поля-приёмника.
// В отличие от психосил, Талант всегда активен, пока на акторе — без
// isSustained-гейта (тот же рубильник, что charBonuses/fearRating Талантов
// в module/documents/actor.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects } from "../../module/combat/weapon-mods.mjs";

function weapon({ equipped = true, props = [] } = {}) {
  return { id: "w1", type: "weapon", system: { equipped, weaponProps: props } };
}

function talentWithBuff({ enabled = true, scope = "equipped", damageMod = 0, penMod = 0, rangeMod = 0, addProps = [] } = {}) {
  return {
    id: "t1", name: "Тестовый Талант", type: "talent",
    system: { effects: { weaponBuff: { enabled, scope, damageMod, penMod, rangeMod, addProps } } }
  };
}

function actorWith(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { items: list };
}

describe("getModEffects: Таланты с weaponBuff (wdbc-g53k)", () => {
  it("+Dmg/+Pen от Таланта складывается в оружие, scope:equipped", () => {
    const w = weapon({ equipped: true });
    const actor = actorWith([talentWithBuff({ damageMod: 2, penMod: 1 })]);
    const fx = getModEffects(actor, w);
    expect(fx.damageMod).toBe(2);
    expect(fx.penMod).toBe(1);
    expect(fx.names).toContain("Тестовый Талант");
  });

  it("scope:equipped не действует на неснаряжённое оружие", () => {
    const w = weapon({ equipped: false });
    const actor = actorWith([talentWithBuff({ damageMod: 5 })]);
    const fx = getModEffects(actor, w);
    expect(fx.damageMod).toBe(0);
  });

  it("scope:force требует свойство force у оружия", () => {
    const w = weapon({ equipped: true, props: [] });
    const actor = actorWith([talentWithBuff({ scope: "force", damageMod: 3 })]);
    expect(getModEffects(actor, w).damageMod).toBe(0);

    const forceWeapon = weapon({ equipped: true, props: [{ key: "force" }] });
    expect(getModEffects(actor, forceWeapon).damageMod).toBe(3);
  });

  it("enabled:false ничего не даёт", () => {
    const w = weapon();
    const actor = actorWith([talentWithBuff({ enabled: false, damageMod: 10 })]);
    expect(getModEffects(actor, w).damageMod).toBe(0);
  });

  it("Талант не требует isSustained/активации — действует просто присутствием на акторе", () => {
    const w = weapon();
    const talent = talentWithBuff({ damageMod: 4 });
    expect(talent.system.isSustained).toBeUndefined(); // нет такого поля у Таланта вовсе
    const actor = actorWith([talent]);
    expect(getModEffects(actor, w).damageMod).toBe(4);
  });

  it("складывается с бонусами от психосил и weaponMod-предметов одновременно", () => {
    const w = weapon();
    const power = { id: "p1", name: "Сила", type: "psychicPower", system: { isSustained: true, effects: { weaponBuff: { enabled: true, scope: "equipped", damageMod: 1 } } } };
    const talent = talentWithBuff({ damageMod: 2 });
    const actor = actorWith([power, talent]);
    expect(getModEffects(actor, w).damageMod).toBe(3);
  });
});
