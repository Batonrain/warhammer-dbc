// test/sheets/attack-mods-autosense-jacks.test.mjs
//
// Sahara 10 (dbc-87), п.2 — Порты Авточувств / Autosense Jacks (core,
// «Модификации → Прочие», стр. 200): «Позволяет получать преимущества прицелов,
// которые обычно требуют Полу-прицеливания или Полного Прицеливания, и без
// прицеливания… при каждом взятии оружия в руки нужно вставлять заново».
//
// Подключение — тумблер мода (activatable/active, как у систем силовой брони);
// фид идёт на ретинальный дисплей Авточувств (requiresWorn пака). Подключённые
// порты = «прицелы с меткой прицеливание работают без Прицеливания».

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";
import { sightAiming, jacksToDisconnect } from "../../module/rules/autosense-jacks.mjs";
import { WeaponModData } from "../../module/data/item/weapon-mod.mjs";

const weapon = { id: "w1", system: { weaponClass: "basic" } };
const mod = (name, system = {}) => ({ id: name.slice(0, 4), type: "weaponMod", name, system: { installedOn: "w1", ...system } });
const optical = () => mod("Optical Sight / Оптический Прицел", { modGroup: "sights" });
const thermal = () => mod("Thermal Sight / Термальный Прицел", { modGroup: "sights" });
const jacks = (active = true) => mod("Auto-senses Ports / Порты Авточувств", { activatable: true, active });
const actorWith = (items, aiming = "none") => ({ items: [...items], system: { aiming } });

function rows(actor) {
  const { specificMods, commonMods } = situationalMods({
    actor, attackCtx: {}, attackerToken: null, gripRange: null, hasFatigue: false,
    hasLostEyes: false, isBlinded: false, isMelee: false, measured: null,
    targetHelpless: false, targetToken: null, weapon, wProps: [], wp: {}
  });
  return { long: specificMods.find(m => m.label === "Дальняя дистанция"), commonMods };
}

describe("sightAiming: подключённые порты = прицеливание для прицелов", () => {
  it("без портов — как есть", () => {
    expect(sightAiming([optical()], "none")).toBe("none");
    expect(sightAiming([optical()], "full")).toBe("full");
  });
  it("порты подключены — «прицеливание» для прицелов есть и без него", () => {
    expect(sightAiming([optical(), jacks(true)], "none")).not.toBe("none");
  });
  it("порты стоят, но не подключены — нет", () => {
    expect(sightAiming([optical(), jacks(false)], "none")).toBe("none");
  });
});

describe("окно атаки: Оптический Прицел через подключённые порты", () => {
  it("без Прицеливания и без портов — штраф дальней дистанции на месте", () => {
    expect(rows(actorWith([optical()])).long.value).toBe(-10);
  });
  it("без Прицеливания, порты подключены — штрафа нет", () => {
    const { long } = rows(actorWith([optical(), jacks(true)]));
    expect(long).toEqual(expect.objectContaining({ value: 0, immune: true }));
  });
  it("порты не подключены — штраф на месте", () => {
    expect(rows(actorWith([optical(), jacks(false)])).long.value).toBe(-10);
  });
  it("Термальный Прицел через порты гасит Слабый свет без Прицеливания", () => {
    const light = rows(actorWith([thermal(), jacks(true)])).commonMods
      .find(m => m.visionPenalty === "light");
    expect(light).toEqual(expect.objectContaining({ value: 0, immune: true }));
  });
});

describe("jacksToDisconnect: оружие убрали — провода отстрелились", () => {
  const actor = { items: [jacks(true), optical()] };
  it("снята галочка «Снаряжено» — подключённые порты этого оружия отключаются", () => {
    expect(jacksToDisconnect(actor, weapon, { system: { equipped: false } }).map(m => m.name))
      .toEqual(["Auto-senses Ports / Порты Авточувств"]);
  });
  it("убрано в хранение — тоже", () => {
    expect(jacksToDisconnect(actor, weapon, { system: { stored: true } })).toHaveLength(1);
  });
  it("прочие правки оружия — нет", () => {
    expect(jacksToDisconnect(actor, weapon, { system: { magazineCur: 3 } })).toEqual([]);
    expect(jacksToDisconnect(actor, weapon, { system: { equipped: true } })).toEqual([]);
  });
  it("порты не подключены — отключать нечего", () => {
    expect(jacksToDisconnect({ items: [jacks(false)] }, weapon, { system: { equipped: false } })).toEqual([]);
  });
});

describe("данные: схема и пак", () => {
  it("у модификации оружия есть пара activatable/active", () => {
    const fields = WeaponModData.defineSchema();
    expect(fields.activatable).toBeDefined();
    expect(fields.active).toBeDefined();
  });
  it("Порты Авточувств в паке включаемые и требуют Авточувств", () => {
    const dir = "packs-src/weapon-mods/Стрелковое/Прочие";
    const file = readdirSync(dir).find(f => f.startsWith("Auto_senses_Ports"));
    const sys = JSON.parse(readFileSync(join(dir, file), "utf8")).system;
    expect(sys.activatable).toBe(true);
    expect(sys.active).toBe(false);
    expect(sys.requiresWorn).toContain("Autosenses");
  });
});
