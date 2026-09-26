// test/combat/combi-own-fire.test.mjs
//
// wdbc-jho9: второй ствол комби-оружия — профиль с ownFire: своя
// скорострельность, свой магазин и своя перезарядка (решение владельца
// 26.09.2026: отдельный магазин, как в книге).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { _reloadWeapon } from "../../module/combat/reload.mjs";
import { sysWithProfileFire, profileHasOwnFire, authoredProfileIndex } from "../../module/combat/weapon-profiles.mjs";

const melta = () => ({ label: "Мелта", ownFire: true, damage: "2d10+4", damageType: "energy", penetration: 12,
  rof_single: 1, rof_semi: 0, rof_full: 0, magazineMax: 1, magazineCur: 1, reload: "2", weaponType: "melta" });

beforeEach(() => { resetCaptured(); setTargets([]); });
afterEach(() => { globalThis.game.combat = undefined; });

describe("поля ствола профиля", () => {
  it("профиль без ownFire не подменяет ничего", () => {
    const sys = { rof_semi: 2, magazineCur: 24 };
    expect(sysWithProfileFire(sys, { label: "Крюк" })).toBe(sys);
    expect(profileHasOwnFire(null)).toBe(false);
  });

  it("свой ствол подменяет скорострельность, магазин, перезарядку и тип боеприпаса", () => {
    const s = sysWithProfileFire({ rof_semi: 2, magazineCur: 24, magazineMax: 24, reload: "½", weaponType: "bolt" }, melta());
    expect(s).toEqual(expect.objectContaining({ rof_semi: 0, magazineCur: 1, magazineMax: 1, reload: "2", weaponType: "melta" }));
  });

  it("индекс профиля — явный, иначе по ссылке", () => {
    const p = melta();
    const item = { system: { profiles: [{ label: "x" }, p] } };
    expect(authoredProfileIndex(item, p)).toBe(1);
    expect(authoredProfileIndex(item, p, 0)).toBe(0);
  });
});

describe("выстрел вторым стволом тратит его магазин", () => {
  it("мелта-подствольник: −1 из магазина профиля, магазин болтера цел", async () => {
    const weapon = weaponFor({ magazineCur: 24, profiles: [melta()] });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5];
    await _executeAttackRoll(actor, weapon, "bs", 55, "single", null, { profile: weapon.system.profiles[0], profileIdx: 0 });
    expect(weapon.system.magazineCur).toBe(24);
    expect(weapon.system.profiles[0].magazineCur).toBe(0);
  });

  it("основным стволом — как раньше, из магазина оружия", async () => {
    const weapon = weaponFor({ magazineCur: 24, profiles: [melta()] });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5];
    await _executeAttackRoll(actor, weapon, "bs", 55, "single", null, {});
    expect(weapon.system.magazineCur).toBe(23);
    expect(weapon.system.profiles[0].magazineCur).toBe(1);
  });
});

describe("перезарядка ствола, выбранного в HUD", () => {
  it("заряжает магазин профиля боеприпасом его типа", async () => {
    const p = { ...melta(), magazineCur: 0 };
    const weapon = weaponFor({ magazineCur: 10, profiles: [p] }, { flags: { "warhammer-dbc.hudProfile": 0 } });
    const ammo = { id: "a1", name: "Мелта-заряд", type: "ammo", system: { quantity: 2, weaponTypes: ["melta"] }, getFlag: () => undefined,
      async update(d) { for (const [k, v] of Object.entries(d)) ammo.system[k.replace(/^system\./, "")] = v; } };
    const actor = actorFor({ items: [weapon, ammo] });
    await _reloadWeapon(actor, weapon);
    expect(weapon.system.profiles[0].magazineCur).toBe(1);
    expect(weapon.system.profiles[0].loadedAmmoId).toBe("a1");
    expect(weapon.system.magazineCur).toBe(10);
    expect(ammo.system.quantity).toBe(1);
  });
});
