// test/combat/tandem-mods.test.mjs
//
// Тандем (Sahara system-destroyed п.2): модификации ВСТРОЕННОГО оружия действуют на выстрел из профиля-тандема.
// Раньше встроенное уходило с листа, а его моды оставались привязаны к его id и молчали; моды тяжёлого носителя
// действовали и на тандем. Теперь профиль помнит id встроенного (tandemGuestId), и getModEffects/getActiveMods с
// этим профилем добавляют моды встроенного. Без профиля-тандема (стрельба из самого тяжёлого) их по-прежнему нет.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { embedTandem } from "../../module/combat/tandem.mjs";
import { getModEffects, getActiveMods } from "../../module/combat/weapon-mods.mjs";
import { tandemProfiles } from "../../module/rules/tandem.mjs";

const read = rel => fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), rel), "utf8");

const TAND = {
  id: "t-tandem", name: "Tandem / Тандем", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "weaponsmith.core.tandem", label: "" }] }] } }
};
const mod = (id, installedOn, effects, extra = {}) => ({
  id, name: `Мод ${id}`, type: "weaponMod", system: { installedOn, effects, ...extra }, getFlag: () => undefined
});

async function build() {
  const host = weaponFor({ weaponClass: "heavy", weight: 20, profiles: [], rof_single: 0, rof_semi: 0, rof_full: 6 }, { id: "heavy", name: "Тяжёлый болтер" });
  const guest = weaponFor({ weaponClass: "basic", weight: 4, damage: "1d10+3", reload: "½", rof_single: 1, rof_semi: 3, rof_full: 0, magazineCur: 17, magazineMax: 60 }, { id: "gun", name: "Лазган" });
  guest.toObject = () => structuredClone({ name: guest.name, type: "weapon", system: guest.system });
  guest.delete = async () => {};
  host.unsetFlag = async () => {};
  host.update = async patch => { if (patch["system.profiles"]) host.system.profiles = patch["system.profiles"]; };
  const hostMod = mod("m-host", "heavy", { damageMod: 1 });
  const guestMod = mod("m-guest", "gun", { damageMod: 2, penMod: 1 });
  const strangerMod = mod("m-other", "elsewhere", { damageMod: 50 });
  const actor = actorFor({ items: [host, guest, TAND, hostMod, guestMod, strangerMod] });
  actor.name = "Оружейник";
  actor.createEmbeddedDocuments = async () => [];
  await embedTandem(actor, host, guest);
  // встроенное оружие ушло с листа — предмета нет, а его мод остался
  actor.items = actor.items.filter(i => i.id !== "gun");
  actor.items.get = id => actor.items.find(i => i.id === id);
  return { actor, host, profile: tandemProfiles(host)[0].profile };
}

beforeEach(() => resetCaptured());

describe("моды встроенного оружия на выстреле профилем Тандема", () => {
  it("профиль запоминает id встроенного оружия", async () => {
    const { profile } = await build();
    expect(profile.tandemGuestId).toBe("gun");
  });

  it("без профиля-тандема — только моды тяжёлого (как раньше)", async () => {
    const { actor, host } = await build();
    expect(getModEffects(actor, host).damageMod).toBe(1);
    expect(getModEffects(actor, host).penMod).toBe(0);
  });

  it("с профилем-тандемом — моды тяжёлого И встроенного, чужие моды не попадают", async () => {
    const { actor, host, profile } = await build();
    const fx = getModEffects(actor, host, { profile });
    expect(fx.damageMod).toBe(3);
    expect(fx.penMod).toBe(1);
    expect(getActiveMods(actor, host, { profile }).map(m => m.id).sort()).toEqual(["m-guest", "m-host"]);
  });

  it("обычный (не тандем) профиль мод встроенного не включает", async () => {
    const { actor, host } = await build();
    expect(getModEffects(actor, host, { profile: { label: "Другой", ownFire: true } }).damageMod).toBe(1);
  });

  it("прицел встроенного оружия заменяет прицел носителя на этот выстрел (один прицел за атаку)", async () => {
    const { actor, host, profile } = await build();
    actor.items.push(mod("s-host", "heavy", { attackMod: 5 }, { modGroup: "sights" }));
    actor.items.push(mod("s-guest", "gun", { attackMod: 10 }, { modGroup: "sights" }));
    expect(getModEffects(actor, host).attackMod).toBe(5);                 // без профиля — прицел носителя
    expect(getModEffects(actor, host, { profile }).attackMod).toBe(10);   // тандем — только прицел встроенного
  });

  it("мод встроенного, чьё требование «носит X» не выполнено, не действует", async () => {
    const { actor, host, profile } = await build();
    actor.items.find(i => i.id === "m-guest").system.requiresWorn = ["Ретинальный Дисплей"];
    expect(getModEffects(actor, host, { profile }).damageMod).toBe(1);
  });
});

describe("стыковка: окно и бросок передают профиль", () => {
  it("окно атаки и бросок считают моды с профилем", () => {
    expect(read("module/sheets/attack-dialog.mjs")).toMatch(/getModEffects\(actor, item, \{ profile: startProfile \}\)/);
    expect(read("module/sheets/attack-dialog.mjs")).toMatch(/getActiveMods\(actor, item, \{ profile: startProfile \}\)/);
    expect(read("module/combat/attack.mjs")).toMatch(/getModEffects\(actor, item, \{ profile: P \}\)/);
  });
});
