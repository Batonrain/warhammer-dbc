// test/rules/full-fire.test.mjs
//
// Full Fire / Полный Огонь и Tandem / Тандем (Стрелок и Оружейник; Sahara 3-5fbf, 3-9d40,
// решения владельца 24–25.10.2026): чистая часть — какие пары стволов предлагаются,
// порог второго выстрела, профиль встроенного оружия, штраф Надёжности установки.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import {
  fullFireOptions, fullFireSecondThreshold, hasFullFire, FULL_FIRE_PENALTY, fullFireRofOptions, fullFireSecondBlockReason
} from "../../module/rules/full-fire.mjs";
import {
  buildTandemProfile, doubleReload, tandemGuestOk, tandemHostOk, tandemProfiles,
  tandemReliabilityPenalty, hasTandem, TANDEM_RELIABILITY_PENALTY
} from "../../module/rules/tandem.mjs";

const talentByKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const FULL = talentByKey("rangedCore.core.fullFire");
const TAND = talentByKey("weaponsmith.core.tandem");

const combiBarrel = { label: "Подствольник", ownFire: true, rof_single: 1, rof_semi: 0, rof_full: 0, magazineMax: 1, magazineCur: 1, damage: "2d10", penetration: 8 };
const rifle = (extra = {}, profiles = [combiBarrel]) =>
  weaponFor({ weaponClass: "basic", equipped: true, profiles, ...extra }, { id: "rifle", name: "Комби-болтер" });

describe("Полный Огонь: какие пары предлагаются", () => {
  it("без Таланта — ничего", () => {
    const w = rifle();
    expect(fullFireOptions(actorFor({ items: [w] }), w)).toEqual([]);
    expect(hasFullFire(actorFor({ items: [FULL] }))).toBe(true);
  });

  it("винтовка + её комби-подствольник: второй профиль того же предмета", () => {
    const w = rifle();
    const opts = fullFireOptions(actorFor({ items: [w, FULL] }), w);
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({ scenario: "combi", kind: "profile", profileIdx: 0, value: "p:0" });
    expect(opts[0].rof.map(o => o.value)).toEqual(["single"]);
  });

  it("длинная винтовка и пистолет комби-пару не образуют (в книге — «винтовка»)", () => {
    const lr = rifle({ weaponProps: [{ key: "longRifle" }] });
    const pi = rifle({ weaponClass: "pistol" });
    expect(fullFireOptions(actorFor({ items: [lr, FULL] }), lr)).toEqual([]);
    expect(fullFireOptions(actorFor({ items: [pi, FULL] }), pi)).toEqual([]);
  });

  it("окно открыто на втором стволе или на «Ударить оружием» — пара не предлагается (ОД платит основной ствол)", () => {
    const w = rifle();
    const a = actorFor({ items: [w, FULL] });
    expect(fullFireOptions(a, w, { startProfile: combiBarrel })).toEqual([]);
    expect(fullFireOptions(a, w, { startProfile: { melee: true } })).toEqual([]);
    expect(fullFireOptions(a, w, { startProfile: { label: "Режим", ownFire: false } })).toHaveLength(1);
  });

  it("рукопашная атака — не предлагается", () => {
    const w = rifle();
    expect(fullFireOptions(actorFor({ items: [w, FULL] }), w, { isMelee: true })).toEqual([]);
  });

  it("тяжёлое + встроенный Тандемом ствол — сценарий «tandem»; комби-ствол тяжёлого — нет", () => {
    const tandem = buildTandemProfile({ rof_single: 1, rof_semi: 3, rof_full: 0, magazineMax: 30, damage: "1d10+4", reload: "½" }, "Лазган");
    const h = weaponFor({ weaponClass: "heavy", equipped: true, profiles: [tandem, combiBarrel] }, { id: "hv", name: "Тяжёлый болтер" });
    const opts = fullFireOptions(actorFor({ items: [h, FULL] }), h);
    expect(opts.map(o => o.scenario)).toEqual(["tandem"]);
    expect(opts[0].rof.map(o => o.value)).toEqual(["single", "semi"]);
  });

  it("ладонь + запястье: другое экипированное оружие со свойством Wrist", () => {
    const palm = weaponFor({ weaponClass: "pistol", equipped: true, profiles: [] }, { id: "palm", name: "Болт-пистолет" });
    const wrist = weaponFor({ weaponClass: "pistol", equipped: true, weaponProps: [{ key: "wrist" }] }, { id: "wr", name: "Наручный игломёт" });
    const loose = weaponFor({ weaponClass: "pistol", equipped: true }, { id: "lo", name: "Второй пистолет" });
    const opts = fullFireOptions(actorFor({ items: [palm, wrist, loose, FULL] }), palm);
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({ scenario: "palmWrist", kind: "item", itemId: "wr", value: "i:wr" });
  });

  it("запястное оружие на другой руке — не пара; не снаряжённое — не пара", () => {
    const palm = weaponFor({ weaponClass: "pistol", equipped: true }, { id: "palm", name: "A", flags: { "warhammer-dbc.heldHand": "left" } });
    const wristR = weaponFor({ weaponClass: "pistol", equipped: true, weaponProps: [{ key: "wrist" }] }, { id: "wr", name: "B", flags: { "warhammer-dbc.heldHand": "right" } });
    const wristOff = weaponFor({ weaponClass: "pistol", equipped: false, weaponProps: [{ key: "wrist" }] }, { id: "w2", name: "C" });
    expect(fullFireOptions(actorFor({ items: [palm, wristR, wristOff, FULL] }), palm)).toEqual([]);
  });

  it("комби-подствольник как отдельный предмет со свойством Combi (так он лежит в паке): пара с винтовкой", () => {
    const main = weaponFor({ weaponClass: "basic", equipped: true, profiles: [] }, { id: "rf", name: "Болтер" });
    const combi = weaponFor({ weaponClass: "basic", equipped: false, weaponProps: [{ key: "combi" }] }, { id: "cm", name: "Комби-Мельта" });
    const stored = weaponFor({ weaponClass: "basic", stored: true, weaponProps: [{ key: "combi" }] }, { id: "st", name: "На складе" });
    const opts = fullFireOptions(actorFor({ items: [main, combi, stored, FULL] }), main);
    expect(opts.map(o => [o.scenario, o.value])).toEqual([["combi", "i:cm"]]);
    // сам Combi-ствол пары как «винтовка» не образует
    expect(fullFireOptions(actorFor({ items: [combi, FULL, main] }), combi)).toEqual([]);
  });

  it("второй ствол не стреляет: сломан, заклинил, магазин пуст", () => {
    const w = (extra = {}) => weaponFor({ magazineCur: 3, magazineMax: 5, ...extra }, { name: "Ствол" });
    expect(fullFireSecondBlockReason(w())).toBe("");
    expect(fullFireSecondBlockReason(w({ destroyed: true }))).toContain("сломано");
    expect(fullFireSecondBlockReason(w({ jammed: true }))).toContain("заклинило");
    expect(fullFireSecondBlockReason(w({ magazineCur: 0 }))).toContain("пуст");
    // профиль-ствол: магазин берётся из профиля, а не из носителя
    expect(fullFireSecondBlockReason(w(), { label: "Подствольник", magazineMax: 1, magazineCur: 0 })).toContain("Подствольник");
    expect(fullFireSecondBlockReason(w({ magazineCur: 0 }), { magazineMax: 1, magazineCur: 1 })).toBe("");
  });

  it("режимы огня второго ствола — по его собственным цифрам", () => {
    expect(fullFireRofOptions({ rof_single: 1, rof_semi: 3, rof_full: 6 }).map(o => o.value)).toEqual(["single", "semi", "full"]);
    expect(fullFireRofOptions({ rof_single: 0, rof_semi: 0, rof_full: 0 })).toEqual([]);
  });
});

describe("Полный Огонь: порог второго выстрела", () => {
  it("штраф книги −10", () => {
    expect(FULL_FIRE_PENALTY).toBe(-10);
  });

  it("порог окна: режим огня заменяется на свой, Прицеливание основного выстрела снимается, оружейная часть — разница", () => {
    // основной: BS 45 + одиночный +10 + Полный Огонь −10 + Прицеливание +10 = 65
    const t = fullFireSecondThreshold({ mainThreshold: 65, mainRofBonus: 10, secondRof: "full", weaponDelta: 5, aimAdjust: 10 });
    expect(t).toBe(65 - 10 + (-10) + 5 - 10);
    expect(fullFireSecondThreshold({ mainThreshold: 55, mainRofBonus: 10, secondRof: "single" })).toBe(55);
  });
});

describe("Тандем: встроенное оружие становится профилем-тандемом", () => {
  it("Rld удваивается: ½ → 1, 1 → 2, прочее не трогается", () => {
    expect(doubleReload("½")).toBe("1");
    expect(doubleReload("1")).toBe("2");
    expect(doubleReload("2")).toBe("4");
    expect(doubleReload("¼")).toBe("½");
    expect(doubleReload("–")).toBe("–");
  });

  it("профиль несёт ствол встроенного оружия и помечен tandem + ownFire", () => {
    const sys = { range: 100, damage: "1d10+3", damageType: "energy", damageSubtype: "E(Ls)", penetration: 0,
      rof_single: 1, rof_semi: 3, rof_full: 0, magazineMax: 60, magazineCur: 41, reload: "½", weaponType: "las",
      weaponProps: [{ key: "reliable" }], weight: 3 };
    const p = buildTandemProfile(sys, "Лазган", { name: "Лазган" });
    expect(p).toMatchObject({ tandem: true, ownFire: true, range: 100, magazineCur: 41, reload: "1", weaponType: "las", tandemWeight: 3, label: "Тандем: Лазган" });
    expect(p.weaponProps).toEqual([{ key: "reliable" }]);
    expect(p.weaponProps).not.toBe(sys.weaponProps);
    expect(p.tandemSource).toEqual({ name: "Лазган" });
  });

  it("встроить можно пистолет и (не длинную) винтовку в тяжёлое", () => {
    const g = c => weaponFor({ weaponClass: c });
    expect(tandemGuestOk(g("pistol"))).toBe(true);
    expect(tandemGuestOk(g("basic"))).toBe(true);
    expect(tandemGuestOk(weaponFor({ weaponClass: "basic", weaponProps: [{ key: "longRifle" }] }))).toBe(false);
    expect(tandemGuestOk(g("heavy"))).toBe(false);
    expect(tandemHostOk(g("heavy"))).toBe(true);
    expect(tandemHostOk(g("basic"))).toBe(false);
  });

  it("tandemProfiles находит только профили-тандемы", () => {
    const h = weaponFor({ weaponClass: "heavy", profiles: [{ label: "Крюк" }, { tandem: true, label: "Т" }] });
    expect(tandemProfiles(h).map(t => t.idx)).toEqual([1]);
  });

  it("−2 Надёжности только у тандема в руках персонажа без Таланта", () => {
    const withT = actorFor({ items: [TAND] });
    const without = actorFor({ items: [] });
    expect(hasTandem(withT)).toBe(true);
    expect(tandemReliabilityPenalty(without, { tandem: true })).toBe(TANDEM_RELIABILITY_PENALTY);
    expect(tandemReliabilityPenalty(withT, { tandem: true })).toBe(0);
    expect(tandemReliabilityPenalty(without, { ownFire: true })).toBe(0);
    expect(tandemReliabilityPenalty(without, null)).toBe(0);
  });
});
