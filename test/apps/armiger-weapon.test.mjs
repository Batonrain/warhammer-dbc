// test/apps/armiger-weapon.test.mjs
//
// module/apps/armiger-weapon.mjs — демон-Оруженосец в оружии (wdbc-1rno,
// шаг D). Тот же приём поиска в Бестиарии и ГМ/сокет-маршрутизации, что у
// module/apps/demon-summon.mjs (test/apps/demon-summon.test.mjs) — только
// цель не токен на сцене, а system.daemonWeapon на предмете-оружии.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import { bindArmigerWeapon, defaultBindArmigerWeaponFn, ARMIGER_DEMON_WB } from "../../module/apps/armiger-weapon.mjs";

function bestiaryPack(entries) {
  return {
    getIndex: async () => entries,
    getDocument: async id => {
      const e = entries.find(x => x._id === id);
      return e ? { ...e, toObject: () => ({ ...e }) } : null;
    }
  };
}

function fakeWeapon(over = {}) {
  const updates = [];
  return {
    name: "Цепной Клинок", updates,
    system: { weaponProps: [], damage: "1d10+3", penetration: 2, daemonWeapon: { bound: false }, ...over },
    update: async data => { updates.push(data); return data; }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = {};
  globalThis.game.users = { activeGM: null };
  globalThis.game.packs = new Map();
  globalThis.fromUuid = async () => null;
});

describe("привязка демона-Оруженосца к оружию (bindArmigerWeapon)", () => {
  it("оружие не найдено — ok:false, ничего не пишется", async () => {
    const res = await bindArmigerWeapon("Item.none", "Кровопускатель", "khorne");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("не найдено");
  });

  it("оружие уже демоническое — ok:false, второй раз не осквернить", async () => {
    const weapon = fakeWeapon({ daemonWeapon: { bound: true } });
    globalThis.fromUuid = async () => weapon;

    const res = await bindArmigerWeapon("Item.w1", "Кровопускатель", "khorne");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("уже демоническое");
    expect(weapon.updates.length).toBe(0);
  });

  it("успех: +W.b к Dmg/Pen, Reinforced, daemonWeapon.bound с фиксированным W.b и реальным Inf из Бестиария", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Bloodletter / Кровопускатель" }]));
    // Реальный Inf демона узнаётся из его карточки в Бестиарии (не выдумывается).
    globalThis.game.packs.get("warhammer-dbc.bestiary").getDocument = async () =>
      ({ system: { characteristics: { inf: { total: 22 } } } });
    const weapon = fakeWeapon();
    globalThis.fromUuid = async uuid => (uuid === "Item.w1" ? weapon : null);

    const res = await bindArmigerWeapon("Item.w1", "Кровопускатель", "khorne");

    expect(res).toEqual({ ok: true, weaponName: "Цепной Клинок" });
    const upd = weapon.updates[0];
    expect(upd["system.damage"]).toBe("1d10+7"); // +4 (ARMIGER_DEMON_WB)
    expect(upd["system.penetration"]).toBe(6);   // 2 + 4
    expect(upd["system.weaponProps"]).toEqual([{ key: "reinforced" }]);
    expect(upd["system.daemonWeapon"]).toMatchObject({
      bound: true, god: "khorne", demonName: "Кровопускатель",
      binding: 0, demonWb: ARMIGER_DEMON_WB, demonInf: 22, subdued: true, runic: false, properties: []
    });
    expect(upd["flags.warhammer-dbc.armigerBound"]).toBe(true);
  });

  it("демон не найден в Бестиарии — всё равно связывает, но Inf = 0 (не выдумывает число)", async () => {
    const weapon = fakeWeapon();
    globalThis.fromUuid = async () => weapon;

    const res = await bindArmigerWeapon("Item.w1", "Неизвестный", "khorne");
    expect(res.ok).toBe(true);
    expect(weapon.updates[0]["system.daemonWeapon"].demonInf).toBe(0);
  });

  it("теряет Primitive и Sanctified, не задваивает уже стоящий Reinforced", async () => {
    const weapon = fakeWeapon({ weaponProps: [{ key: "primitive" }, { key: "sanctified" }, { key: "reinforced" }] });
    globalThis.fromUuid = async () => weapon;

    await bindArmigerWeapon("Item.w1", "Кровопускатель", "khorne");
    expect(weapon.updates[0]["system.weaponProps"]).toEqual([{ key: "reinforced" }]);
  });

  it("снимок исходных Dmg/Pen/свойств сохраняется для будущего изгнания", async () => {
    const weapon = fakeWeapon({ damage: "1d10+2", penetration: 0, weaponProps: [{ key: "flexible" }] });
    globalThis.fromUuid = async () => weapon;

    await bindArmigerWeapon("Item.w1", "Кровопускатель", "khorne");
    expect(weapon.updates[0]["system.daemonWeapon"]).toMatchObject({
      preProps: [{ key: "flexible" }], preDamage: "1d10+2", prePen: 0
    });
  });
});

describe("маршрутизация вызова (defaultBindArmigerWeaponFn)", () => {
  it("ГМ — вызывает напрямую", async () => {
    globalThis.game.user = { isGM: true };
    const weapon = fakeWeapon();
    globalThis.fromUuid = async () => weapon;

    await defaultBindArmigerWeaponFn("Item.w1", "Кровопускатель", "khorne");

    expect(weapon.updates.length).toBe(1);
    expect(captured.warnings).toEqual([]);
  });

  it("не ГМ, есть активный ГМ — шлёт сокет-релей, ничего не пишет сам", async () => {
    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = { id: "gm-1" };
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };

    await defaultBindArmigerWeaponFn("Item.w1", "Кровопускатель", "khorne");

    expect(emitted).toEqual([{
      channel: "system.warhammer-dbc",
      data: { action: "bindArmigerWeapon", userId: "user-1", weaponUuid: "Item.w1", demonName: "Кровопускатель", god: "khorne" }
    }]);
  });

  it("не ГМ, нет активного ГМа — предупреждает, не шлёт сокет", async () => {
    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = null;
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };

    await defaultBindArmigerWeaponFn("Item.w1", "Кровопускатель", "khorne");

    expect(emitted).toEqual([]);
    expect(captured.warnings.some(w => /активного Мастера/.test(w))).toBe(true);
  });

  it("нет oружия/демона — ничего не делает", async () => {
    globalThis.game.user = { isGM: true };
    await defaultBindArmigerWeaponFn("", "Кровопускатель", "khorne");
    await defaultBindArmigerWeaponFn("Item.w1", "", "khorne");
    expect(captured.warnings).toEqual([]);
  });
});
