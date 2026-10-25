// test/rules/melee-talents.test.mjs
//
// Чистые функции Талантов «Рукопашные» главы 3 (Sahara 3-8dc5): rules/melee-talents.mjs.
// Те, что живут в атаке и окне, — test/combat/attack-melee-talents.test.mjs и
// test/sheets/attack-selection-grind.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import {
  blademasterRerollOffered, isBladeWeapon, raptorBonusDice, fleshRenderExtraDrop, riposteWeapon, cleaveTriggered
} from "../../module/rules/melee-talents.mjs";

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const sword = (extra = {}) => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", ...extra });

describe("Мастер Клинка: когда на карточке предлагается бесплатный переброс", () => {
  const BM = "meleeCore.core.blademaster";
  const base = { item: sword(), isMelee: true, rv: 70, threshold: 45, rerolled: false, roundAvailable: true };

  it("провал клинком, Талант по ключу — предлагается", () => {
    expect(blademasterRerollOffered(actorFor({ items: [talentByKey(BM)] }), base)).toBe(true);
  });

  it("Талант по имени (снимок без записи Конструктора) — тоже", () => {
    expect(blademasterRerollOffered(actorFor({ items: [talentByName("Blademaster / Мастер Клинка")] }), base)).toBe(true);
  });

  it("без Таланта — нет", () => {
    expect(blademasterRerollOffered(actorFor({}), base)).toBe(false);
  });

  it("успешная атака — переброс не предлагается", () => {
    const a = actorFor({ items: [talentByKey(BM)] });
    expect(blademasterRerollOffered(a, { ...base, rv: 30 })).toBe(false);
    expect(blademasterRerollOffered(a, { ...base, rv: 45 })).toBe(false);
  });

  it("раз в Раунд: если Талант уже использован — нет", () => {
    expect(blademasterRerollOffered(actorFor({ items: [talentByKey(BM)] }), { ...base, roundAvailable: false })).toBe(false);
  });

  it("карточка уже переброшена — переброса переброса нет", () => {
    expect(blademasterRerollOffered(actorFor({ items: [talentByKey(BM)] }), { ...base, rerolled: true })).toBe(false);
  });

  it("не клинковое оружие (булава, стрелковое) — нет", () => {
    const a = actorFor({ items: [talentByKey(BM)] });
    expect(blademasterRerollOffered(a, { ...base, item: weaponFor({ weaponClass: "melee", meleeCategory: "Булава" }) })).toBe(false);
    expect(blademasterRerollOffered(a, { ...base, item: weaponFor({ weaponClass: "basic" }), isMelee: true })).toBe(false);
  });

  it("стрелковая атака — нет", () => {
    expect(blademasterRerollOffered(actorFor({ items: [talentByKey(BM)] }), { ...base, isMelee: false })).toBe(false);
  });

  it("клинковое: меч и нож, не булава и не топор", () => {
    expect(isBladeWeapon(sword())).toBe(true);
    expect(isBladeWeapon(weaponFor({ weaponClass: "melee", meleeCategory: "Нож" }))).toBe(true);
    expect(isBladeWeapon(weaponFor({ weaponClass: "melee", meleeCategory: "Топор" }))).toBe(false);
  });
});

describe("Разрубить: когда удар даёт дополнительную атаку", () => {
  const CL = "meleeCore.core.cleave";
  const hit = { melee: true, cleaveChild: false, net: 16, woundsBefore: 5, woundsAfter: 0 };
  const a = actorFor({ items: [talentByKey(CL)] });

  it("16 непоглощённого и цель вышла из строя (Раны 5 → 0) — да", () => {
    expect(cleaveTriggered(a, hit)).toBe(true);
    expect(cleaveTriggered(a, { ...hit, woundsAfter: -4 })).toBe(true);
  });

  it("по имени (снимок без записи Конструктора) — тоже", () => {
    expect(cleaveTriggered(actorFor({ items: [talentByName("Cleave / Разрубить")] }), hit)).toBe(true);
  });

  it("15 непоглощённого — нет (порог 16 включительно)", () => {
    expect(cleaveTriggered(a, { ...hit, net: 15 })).toBe(false);
  });

  it("цель осталась на ногах (Раны после > 0) — нет", () => {
    expect(cleaveTriggered(a, { ...hit, woundsAfter: 1 })).toBe(false);
  });

  it("цель и так была из строя (Раны до ≤ 0) — этот удар её не выводил", () => {
    expect(cleaveTriggered(a, { ...hit, woundsBefore: 0, woundsAfter: -9 })).toBe(false);
  });

  it("сама дополнительная атака Разрубания новых не порождает", () => {
    expect(cleaveTriggered(a, { ...hit, cleaveChild: true })).toBe(false);
  });

  it("стрелковый удар и актор без Таланта — нет", () => {
    expect(cleaveTriggered(a, { ...hit, melee: false })).toBe(false);
    expect(cleaveTriggered(actorFor({}), hit)).toBe(false);
  });
});

describe("Рипост: чем отвечать после успешного Парирования", () => {
  const RIP = "meleeCore.core.riposte";
  const held = (name, system = {}) => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", equipped: true, balance: 0, ...system }, { id: name, name });
  const twoWeapon = spec => ({ id: "tww", name: "Two Weapon Wielder", type: "talent", system: { specialization: spec } });
  const ok = { roundAvailable: true };

  it("парировал одним мечом, в другой руке меч с Балансом 0 — Рипост вторым мечом", () => {
    const main = held("main"), off = held("off");
    const a = actorFor({ items: [main, off, talentByKey(RIP), twoWeapon("Melee")] });
    expect(riposteWeapon(a, main, ok)?.id).toBe("off");
  });

  it("Талант по имени (снимок без записи Конструктора) — тоже", () => {
    const main = held("main"), off = held("off");
    const a = actorFor({ items: [main, off, talentByName("Riposte / Рипост"), twoWeapon("Melee")] });
    expect(riposteWeapon(a, main, ok)?.id).toBe("off");
  });

  it("не тем же оружием: если рука одна — Рипоста нет (нужны два оружия)", () => {
    const main = held("main");
    expect(riposteWeapon(actorFor({ items: [main, talentByKey(RIP)] }), main, ok)).toBeNull();
  });

  it("Баланс другого оружия ниже 0 — оно не годится", () => {
    const main = held("main"), off = held("off", { balance: -1 });
    expect(riposteWeapon(actorFor({ items: [main, off, talentByKey(RIP)] }), main, ok)).toBeNull();
  });

  it("без Таланта, раз в Раунд уже потрачено, Крестовой Блок — нет", () => {
    const main = held("main"), off = held("off");
    expect(riposteWeapon(actorFor({ items: [main, off] }), main, ok)).toBeNull();
    const a = actorFor({ items: [main, off, talentByKey(RIP)] });
    expect(riposteWeapon(a, main, { roundAvailable: false })).toBeNull();
    expect(riposteWeapon(a, main, { ...ok, crossblock: true })).toBeNull();
  });

  it("пистолет годится только с Two Weapon Wielder (Ranged); винтовка — никогда", () => {
    const main = held("main");
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, balance: 0 }, { id: "pistol", name: "Пистолет" });
    const rifle = weaponFor({ weaponClass: "basic", equipped: true, balance: 0 }, { id: "rifle", name: "Винтовка" });
    const meleeOnly = actorFor({ items: [main, pistol, talentByKey(RIP), twoWeapon("Melee")] });
    expect(riposteWeapon(meleeOnly, main, ok)).toBeNull();
    const both = actorFor({ items: [main, pistol, talentByKey(RIP), twoWeapon("Melee, Ranged")] });
    expect(riposteWeapon(both, main, ok)?.id).toBe("pistol");
    const withRifle = actorFor({ items: [main, rifle, talentByKey(RIP), twoWeapon("Melee, Ranged")] });
    expect(riposteWeapon(withRifle, main, ok)).toBeNull();
  });
});

describe("Раптор и Терзатель Плоти: пороги чистых функций", () => {
  const RAPTOR = "meleeCore.core.raptor";
  const a = actorFor({ items: [talentByKey(RAPTOR)] });

  it("кубы по лестнице 2+ / 4+", () => {
    expect([1, 2, 3, 4, 5, 9].map(deg => raptorBonusDice(a, { chargeFromFlight: true, deg }))).toEqual([0, 1, 1, 2, 2, 2]);
  });

  it("не в полёте — 0, без Таланта — 0", () => {
    expect(raptorBonusDice(a, { chargeFromFlight: false, deg: 6 })).toBe(0);
    expect(raptorBonusDice(actorFor({}), { chargeFromFlight: true, deg: 6 })).toBe(0);
  });

  it("Терзатель: нужно и Рвущее, и рукопашная", () => {
    const f = actorFor({ items: [talentByKey("meleeCore.core.fleshRender")] });
    expect(fleshRenderExtraDrop(f, { isMelee: true, tearing: true })).toBe(1);
    expect(fleshRenderExtraDrop(f, { isMelee: true, tearing: false })).toBe(0);
    expect(fleshRenderExtraDrop(f, { isMelee: false, tearing: true })).toBe(0);
    expect(fleshRenderExtraDrop(actorFor({}), { isMelee: true, tearing: true })).toBe(0);
  });
});
