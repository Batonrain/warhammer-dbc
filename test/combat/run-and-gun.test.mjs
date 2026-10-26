// test/combat/run-and-gun.test.mjs
//
// Run and Gun / Стрельба на Бегу (Талант Стрелка, Sahara 3-5fbf) и Bayonet
// Charge / Штыковая Атака (Талант Рукопашных, Sahara 3-8dc5): свободный выстрел
// на Натиске / после попадания штыком; замок «стрелявшее и не сложенное оружие
// молчит в рукопашной в этот Ход» (решения владельца 24.10.2026).

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import {
  runAndGunOfferHtml, bayonetShotButtonsHtml, runAndGunLockedNow, consumeFreeShot,
  releaseRunAndGunLock, freeShotBlockReason, activateFreeShot
} from "../../module/combat/free-shot.mjs";
import {
  RUN_AND_GUN_PENDING_FLAG, RUN_AND_GUN_FIRED_FLAG, BAYONET_SHOT_PENDING_FLAG,
  runAndGunEligibleWeapon, bayonetShotEligibleWeapon, runAndGunLockReason,
  freeShotLocksAim, freeShotCountsAsAttack, freeShotRofModes
} from "../../module/rules/run-and-gun.mjs";
import { MELEE_MANEUVERS } from "../../module/constants/combat.mjs";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";
import { TURN_SCOPED_FLAGS } from "../../module/rules/turn-flags.mjs";

const NS = "warhammer-dbc";
const RAG = { key: "rangedCore.core.runAndGun", name: "Run and Gun / Стрельба на Бегу" };
const BAY = { key: "meleeCore.core.bayonetCharge", name: "Bayonet Charge / Штыковая Атака" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "n-" + name, name, type: "talent", system: {} });

function who(items, { token = null } = {}) {
  const a = actorFor({ items, characteristics: { ws: char(50), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
  a.uuid = "Actor.shooter"; a.name = "Стрелок"; a.type = "character"; a.isOwner = true;
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async () => {};
  a.store = store;
  a.getActiveTokens = () => (token ? [{ document: token }] : []);
  return a;
}
const gun = (extra = {}, id = "rifle") => weaponFor({ weaponClass: "basic", equipped: true, rof_single: 1, ...extra }, { id, name: "Лазган" });
const tokenDoc = ({ id, x = 0, y = 0, disposition = -1 }) =>
  ({ id, uuid: "Scene.s.Token." + id, name: id, x, y, width: 2, height: 2, disposition, actor: { type: "character", system: {} } });

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { tokens: { placeables: [] } };
});

describe("чистые правила", () => {
  it("подходящее оружие: Пистолет/Ручное/Метательное, не Тяжёлое; Штык — только огнестрел", () => {
    expect(runAndGunEligibleWeapon(gun({ weaponClass: "pistol" }))).toBe(true);
    expect(runAndGunEligibleWeapon(gun({ weaponClass: "thrown" }))).toBe(true);
    expect(runAndGunEligibleWeapon(gun({ weaponClass: "heavy" }))).toBe(false);
    expect(runAndGunEligibleWeapon(gun({ weaponClass: "melee" }))).toBe(false);
    expect(bayonetShotEligibleWeapon(gun({ weaponClass: "thrown" }))).toBe(false);
    expect(bayonetShotEligibleWeapon(gun({ weaponClass: "basic" }))).toBe(true);
  });

  it("замок: тот же id оружия, не рукопашная атака, персонаж в рукопашной", () => {
    const a = who([]);
    a.store[`${NS}.${RUN_AND_GUN_FIRED_FLAG}`] = "rifle";
    const rifle = gun();
    expect(runAndGunLockReason(a, rifle, { isMelee: false, inMelee: true })).toContain("Стрельба на Бегу");
    expect(runAndGunLockReason(a, rifle, { isMelee: false, inMelee: false })).toBe("");
    expect(runAndGunLockReason(a, rifle, { isMelee: true, inMelee: true })).toBe("");
    expect(runAndGunLockReason(a, gun({}, "other"), { isMelee: false, inMelee: true })).toBe("");
  });

  it("режимы и счёт Атаки по видам бесплатных выстрелов", () => {
    expect(freeShotRofModes("runAndGun")).toEqual(["single", "semi", "full"]);
    expect(freeShotRofModes("bayonetCharge")).toEqual(["single", "semi", "full"]);
    expect(freeShotRofModes("hipShooting")).toEqual(["single"]);
    expect(freeShotRofModes("coveringFire")).toEqual(["semi", "full"]);
    expect(freeShotLocksAim("runAndGun")).toBe(true);
    expect(freeShotLocksAim("bayonetCharge")).toBe(false);
    expect(freeShotLocksAim("coveringFire")).toBe(false);
    expect(freeShotCountsAsAttack("")).toBe(true);
    expect(freeShotCountsAsAttack("hipShooting")).toBe(true);
    expect(freeShotCountsAsAttack("runAndGun")).toBe(false);
    expect(freeShotCountsAsAttack("bayonetCharge")).toBe(false);
    expect(freeShotCountsAsAttack("drawFire")).toBe(false);
  });

  it("метки Хода зарегистрированы", () => {
    for (const k of [RUN_AND_GUN_PENDING_FLAG, RUN_AND_GUN_FIRED_FLAG, BAYONET_SHOT_PENDING_FLAG]) expect(TURN_SCOPED_FLAGS).toHaveProperty(k);
  });

  it("Приём «Штыковая Атака»: штык, База любая, −10, нужен Талант", () => {
    const m = MELEE_MANEUVERS.bayonetCharge;
    expect(m.wsBonus).toBe(-10);
    expect(m.categories).toEqual(["Штык"]);
    expect(m.bases).toBeUndefined();
    expect(m.requiresCapability).toBe(BAY.key);
  });
});

describe("Стрельба на Бегу: предложение и поток", () => {
  it("кнопка на каждое подходящее экипированное оружие; без Таланта и без оружия — нет", () => {
    for (const t of [byName(RAG.name), byKey(RAG.key)]) {
      const a = who([t, gun({}, "r1"), gun({ weaponClass: "pistol" }, "p1"), gun({ weaponClass: "heavy" }, "h1"), gun({ equipped: false }, "off")]);
      const html = runAndGunOfferHtml(a);
      expect(html.match(/data-kind="runAndGun"/g)).toHaveLength(2);
      expect(html).toContain('data-item-id="r1"');
      expect(html).toContain('data-item-id="p1"');
      expect(html).not.toContain('data-item-id="h1"');
    }
    expect(runAndGunOfferHtml(who([gun()]))).toBe("");
    expect(runAndGunOfferHtml(who([byName(RAG.name)]))).toContain("нет экипированного");
  });

  it("выстрел снимает метку и запирает оружие; Сложить снимает замок", async () => {
    const rifle = gun();
    const a = who([byName(RAG.name), rifle]);
    a.store[`${NS}.${RUN_AND_GUN_PENDING_FLAG}`] = true;
    expect(freeShotBlockReason(a, "runAndGun")).toBe("");
    await consumeFreeShot(a, "runAndGun", rifle);
    expect(a.store[`${NS}.${RUN_AND_GUN_PENDING_FLAG}`]).toBeUndefined();
    expect(a.store[`${NS}.${RUN_AND_GUN_FIRED_FLAG}`]).toBe("rifle");
    expect(freeShotBlockReason(a, "runAndGun")).toContain("уже сделан");
    await releaseRunAndGunLock(a, gun({}, "other"));       // другое оружие не снимает
    expect(a.store[`${NS}.${RUN_AND_GUN_FIRED_FLAG}`]).toBe("rifle");
    await releaseRunAndGunLock(a, rifle);
    expect(a.store[`${NS}.${RUN_AND_GUN_FIRED_FLAG}`]).toBeUndefined();
  });

  it("замок действует только когда актор в базовом контакте с врагом", () => {
    const rifle = gun();
    const me = tokenDoc({ id: "me", x: 0, y: 0, disposition: 1 });
    const foe = tokenDoc({ id: "foe", x: 2, y: 0 });
    const far = tokenDoc({ id: "far", x: 50, y: 50 });
    const a = who([byName(RAG.name), rifle], { token: me });
    a.store[`${NS}.${RUN_AND_GUN_FIRED_FLAG}`] = "rifle";
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [me, far].map(d => ({ document: d })) } };
    expect(runAndGunLockedNow(a, rifle, { isMelee: false })).toBe("");                 // контакта нет
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [me, foe, far].map(d => ({ document: d })) } };
    expect(runAndGunLockedNow(a, rifle, { isMelee: false })).toContain("в рукопашной");
    expect(runAndGunLockedNow(a, rifle, { isMelee: true })).toBe("");                  // рукопашной атаке замок не мешает
  });

  it("активация: без метки и с неподходящим оружием — предупреждение, окно не открывается", async () => {
    const heavy = gun({ weaponClass: "heavy" }, "h1");
    const a = who([byName(RAG.name), heavy]);
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : null);
    const warns = [];
    const prev = globalThis.ui.notifications.warn;
    globalThis.ui.notifications.warn = m => { warns.push(m); };
    try {
      await activateFreeShot(a.uuid, "runAndGun", "h1");                       // метки нет
      a.store[`${NS}.${RUN_AND_GUN_PENDING_FLAG}`] = true;
      await activateFreeShot(a.uuid, "runAndGun", "h1");                       // тяжёлое
    } finally { globalThis.ui.notifications.warn = prev; }
    expect(warns).toHaveLength(2);
    expect(captured.dialog).toBeFalsy();
  });
});

describe("Штыковая Атака: попадание штыком даёт выстрел в упор", () => {
  const bayonet = () => weaponFor({ weaponClass: "melee", meleeCategory: "Штык", grips: "2р", damage: "1d10", equipped: true }, { id: "bay", name: "Bayonet / Штык" });
  const strike = async (a, technique) => {
    captured.dice = [10, 5, 5];
    await _executeAttackRoll(a, bayonet(), "ws", 50, "melee", null, { techniqueOpts: technique ? { technique } : {} });
  };
  const card = () => captured.chat.at(-1)?.content ?? "";

  it("Приём + Талант + попадание: метка и кнопка на огнестрел; без Приёма или без Таланта — нет", async () => {
    for (const t of [byName(BAY.name), byKey(BAY.key)]) {
      resetCaptured();
      const a = who([t, bayonet(), gun({}, "r1")]);
      await strike(a, "bayonetCharge");
      expect(a.store[`${NS}.${BAYONET_SHOT_PENDING_FLAG}`]).toBe(true);
      expect(card()).toContain('data-kind="bayonetCharge"');
      expect(card()).toContain('data-item-id="r1"');
    }
    resetCaptured();
    const a2 = who([byName(BAY.name), bayonet(), gun()]);
    await strike(a2, "");
    expect(a2.store[`${NS}.${BAYONET_SHOT_PENDING_FLAG}`]).toBeUndefined();
    expect(card()).not.toContain('data-kind="bayonetCharge"');
    resetCaptured();
    const a3 = who([bayonet(), gun()]);
    await strike(a3, "bayonetCharge");
    expect(card()).not.toContain('data-kind="bayonetCharge"');
  });

  it("промах: метки нет", async () => {
    const a = who([byName(BAY.name), bayonet(), gun()]);
    captured.dice = [99, 5, 5];
    await _executeAttackRoll(a, bayonet(), "ws", 50, "melee", null, { techniqueOpts: { technique: "bayonetCharge" } });
    expect(a.store[`${NS}.${BAYONET_SHOT_PENDING_FLAG}`]).toBeUndefined();
  });

  it("кнопки только при метке и огнестреле", () => {
    const a = who([byName(BAY.name), gun({}, "r1")]);
    expect(bayonetShotButtonsHtml(a)).toBe("");                                   // метки нет
    a.store[`${NS}.${BAYONET_SHOT_PENDING_FLAG}`] = true;
    expect(bayonetShotButtonsHtml(a)).toContain('data-item-id="r1"');
    expect(bayonetShotButtonsHtml(who([byName(BAY.name)]))).toBe("");
  });

  it("выстрел снимает метку", async () => {
    const a = who([byName(BAY.name), gun()]);
    a.store[`${NS}.${BAYONET_SHOT_PENDING_FLAG}`] = true;
    await consumeFreeShot(a, "bayonetCharge", gun());
    expect(a.store[`${NS}.${BAYONET_SHOT_PENDING_FLAG}`]).toBeUndefined();
    expect(freeShotBlockReason(a, "bayonetCharge")).toContain("уже сделан");
  });
});

describe("Штыковая Атака: выстрел «как в упор», +30 несмотря на связанность", () => {
  const row = args => situationalMods({
    actor: { items: [], system: {} }, attackCtx: {}, attackerToken: null, gripRange: 100, hasFatigue: false,
    hasLostEyes: false, isBlinded: false, isMelee: false, measured: { edgeM: 1, contact: "base" },
    targetHelpless: false, targetToken: null, weapon: null, wProps: [], wp: {}, ...args
  }).specificMods.find(m => m.label === "Дистанция в упор");

  it("в контакте Баз обычный выстрел +0, выстрел Штыковой Атаки +30 и строка отмечена", () => {
    expect(row({})).toMatchObject({ value: 0 });
    expect(row({ pointBlankForced: true })).toMatchObject({ value: 30, autoCheck: true });
  });
  // Sahara pyromaniac-20 п.3: книга — «как если бы это был выстрел в упор … невзирая на то что персонаж связан в
  // ближнем бою»: штраф «Стрельба в рукопашную» −20 (не-Пистолет) к такому выстрелу не применяется.
  it("штраф «Стрельба в рукопашную» −20: у обычного выстрела винтовки есть, у выстрела Штыковой Атаки снят", () => {
    const meleeShot = args => situationalMods({
      actor: { items: [], system: {} }, attackCtx: {}, attackerToken: null, gripRange: 100, hasFatigue: false,
      hasLostEyes: false, isBlinded: false, isMelee: false, measured: { edgeM: 1, contact: "base" },
      targetHelpless: false, targetToken: null, weapon: { system: { weaponClass: "basic" } }, wProps: [], wp: {}, ...args
    }).specificMods.find(m => m.label === "Стрельба в рукопашную");
    expect(meleeShot({})).toMatchObject({ value: -20 });
    expect(meleeShot({ pointBlankForced: true })).toMatchObject({ value: 0 });
    expect(meleeShot({ pointBlankForced: true }).note).toContain("Штыковая Атака");
  });
  it("окно передаёт признак только для freeShot bayonetCharge", () => {
    const src = fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), "module/sheets/attack-dialog.mjs"), "utf8");
    expect(src).toMatch(/pointBlankForced: techniqueOpts\.freeShot === "bayonetCharge"/);
  });
});

describe("стыковка", () => {
  const read = rel => fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), rel), "utf8");
  it("окно атаки проверяет замок и не считает выстрел Атакой", () => {
    const d = read("module/sheets/attack/dialog.mjs");
    expect(d).toMatch(/runAndGunLockedNow\(actor, item, \{ isMelee \}\)/);
    expect(d).toMatch(/freeShotCountsAsAttack\(freeShot\)/);
    expect(d).toMatch(/consumeFreeShot\(actor, freeShot, item\)/);
  });
  it("Натиск ставит метку и предлагает выстрел; Сложить снимает замок", () => {
    expect(read("module/combat/movement-actions.mjs")).toMatch(/RUN_AND_GUN_PENDING_FLAG, true/);
    expect(read("module/combat/movement-actions.mjs")).toMatch(/runAndGunOfferHtml\(actor\)/);
    expect(read("module/sheets/tabs/gear.mjs")).toMatch(/releaseRunAndGunLock\(item\.parent, item\)/);
  });
});
