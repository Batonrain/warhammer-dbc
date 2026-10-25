// test/combat/igniter.test.mjs
//
// Igniter / Поджигатель (Талант Оружейника, Sahara 3-9d40): Избирательный выстрел из
// Фосфорного оружия получает эффект по месту — голова: Blinding игнорирует визоры;
// торс: цель перебрасывает успешный тест A против загорания; рука: если загорелась —
// W+0, провал — роняет то, что держала; нога: если загорелась — W+0, провал — падает.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { buildTargetEffectButtons } from "../../module/combat/weapon-properties.mjs";
import { igniterZone, igniterFollowUp, isPhosphorWeapon } from "../../module/rules/gunsmith-talents.mjs";

const { _applyWeaponPropEffect } = await import("../../module/hooks.mjs");

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const IGNITER = "weaponsmith.core.igniter";

const phosphor = (name = "Phosphor Blaster / Фосфорный Бластер", extra = {}) => weaponFor({
  weaponType: "exotic", weaponClass: "pistol", range: 30, damage: "1d10", penetration: 0, magazineCur: 10, magazineMax: 10, rof_single: 1,
  weaponProps: [{ key: "blinding", rating: 1 }, { key: "flame", rating: "1d10" }], ...extra
}, { name, id: "w-ph" });
const shooter = items => actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), i: char(40) } });

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Поджигатель: чистые правила", () => {
  it("Фосфорное оружие — по названию, граната не в счёт", () => {
    expect(isPhosphorWeapon({ name: "Phosphor Pistol / Фосфорный Пистолет", system: { weaponType: "exotic" } })).toBe(true);
    expect(isPhosphorWeapon({ name: "Phosphor / Фосфорная", system: { weaponType: "grenade" } })).toBe(false);
    expect(isPhosphorWeapon({ name: "Болтер", system: { weaponType: "bolt" } })).toBe(false);
  });

  it("зона: только Избирательный выстрел в голову/торс/руку/ногу, Талант обязателен", () => {
    const a = shooter([byKey(IGNITER)]);
    const w = phosphor();
    for (const z of ["head", "torso", "arm", "leg"]) expect(igniterZone(a, { item: w, isMelee: false, aimValue: z })).toBe(z);
    for (const z of ["eye", "joint", "underfoot", undefined]) expect(igniterZone(a, { item: w, isMelee: false, aimValue: z })).toBeNull();
    expect(igniterZone(shooter([]), { item: w, isMelee: false, aimValue: "head" })).toBeNull();
    expect(igniterZone(a, { item: w, isMelee: true, aimValue: "head" })).toBeNull();
    expect(igniterZone(a, { item: weaponFor({ weaponType: "bolt" }, { name: "Болтер" }), isMelee: false, aimValue: "head" })).toBeNull();
  });

  it("второй шаг только у руки и ноги и только если цель загорелась", () => {
    expect(igniterFollowUp("arm", true)).toBe("willTest");
    expect(igniterFollowUp("leg", true)).toBe("willTest");
    expect(igniterFollowUp("arm", false)).toBeNull();
    expect(igniterFollowUp("torso", true)).toBeNull();
    expect(igniterFollowUp("head", true)).toBeNull();
    expect(igniterFollowUp("", true)).toBeNull();
  });
});

describe("Поджигатель: кнопки и карточка атаки", () => {
  const props = [
    { def: { key: "blinding", label: "Ослепляющее", auto: { targetEffect: { condition: "blinded", testChar: "per", testPerRating: -10, levelPerDoP: true, rounds: true } } }, rating: 1 },
    { def: { key: "flame", label: "Огненное", auto: { targetEffect: { condition: "burning", testChar: "ag", damageFromRating: true } } }, rating: "1d10" },
    { def: { key: "toxic", label: "Ядовитое", auto: { targetEffect: { condition: "poisoned", testChar: "t", damage: "1d10" } } }, rating: 0 }
  ];

  it("зона едет на кнопках Ослепления и Горения, не на прочих", () => {
    const html = buildTargetEffectButtons(props, { hit: true, igniter: "arm" });
    const btn = cond => html.match(new RegExp(`<button[^>]*data-wp-condition="${cond}"[^>]*>`))[0];
    expect(btn("blinded")).toContain('data-wp-igniter="arm"');
    expect(btn("burning")).toContain('data-wp-igniter="arm"');
    expect(btn("poisoned")).toContain('data-wp-igniter=""');
    expect(buildTargetEffectButtons(props, { hit: true })).not.toContain('data-wp-igniter="arm"');
  });

  it("Избирательный выстрел в руку Фосфорным оружием: у кнопок зона, в карточке строка; без Таланта — нет", async () => {
    const run = async items => {
      resetCaptured();
      captured.dice = [20, 3, 3, 3, 3];
      const w = phosphor();
      await _executeAttackRoll(shooter(items.concat(w)), w, "bs", 45, "single", { value: "arm", label: "Рука" }, {});
      return captured.chat.at(-1).content;
    };
    const withTalent = await run([byKey(IGNITER)]);
    expect(withTalent).toContain('data-wp-igniter="arm"');
    expect(withTalent).toContain("Поджигатель (рука)");
    const without = await run([]);
    expect(without).not.toContain('data-wp-igniter="arm"');
    expect(without).not.toContain("Поджигатель");
  });
});

describe("Поджигатель: исход на цели", () => {
  const target = ({ items = [], wp = 40, ag = 50, per = 40 } = {}) => {
    const system = { characteristics: { ag: { total: ag }, wp: { total: wp }, per: { total: per } }, conditions: {}, wounds: { value: 20, max: 20, critical: 0 } };
    return {
      uuid: "Actor.forced1", name: "Цель", isOwner: true, type: "character", system, items,
      getActiveTokens: () => [{ document: { regions: new Set() } }],
      update: async changes => {
        captured.updates.push(changes);
        for (const [k, v] of Object.entries(changes)) if (k.startsWith("system.conditions.")) system.conditions[k.slice("system.conditions.".length)] = v;
      }
    };
  };
  const burn = { wpForceActorUuid: "Actor.forced1", wpLabel: "Огненное", wpKey: "flame", wpCondition: "burning", wpTestChar: "ag", wpTestMod: "0", wpDamage: "1d10" };
  const blind = { wpForceActorUuid: "Actor.forced1", wpLabel: "Ослепляющее", wpKey: "blinding", wpCondition: "blinded", wpTestChar: "per", wpTestMod: "-10", wpDamage: "", wpRounds: "1", wpLevelPerDop: "1" };
  const lastCard = () => captured.chat.at(-1).content;

  it("голова: визор (blindingVisor) гасит Blinding, а с Поджигателем в голову — не гасит", async () => {
    const visored = () => target({ items: [byKey("weaponPropertyImmunity.blindingVisor")] });
    globalThis.fromUuid = async () => visored();
    await _applyWeaponPropEffect({ ...blind });
    expect(lastCard()).toContain("Иммунитет");
    resetCaptured();
    captured.dice = [95, 3];
    globalThis.fromUuid = async () => visored();
    await _applyWeaponPropEffect({ ...blind, wpIgniter: "head" });
    expect(lastCard()).not.toContain("Иммунитет — эффект не применён");
    expect(lastCard()).toContain("Провал");
  });

  it("голова: настоящий иммунитет к Blinding Поджигатель не пробивает", async () => {
    globalThis.fromUuid = async () => target({ items: [byKey("weaponPropertyImmunity.blinding")] });
    await _applyWeaponPropEffect({ ...blind, wpIgniter: "head" });
    expect(lastCard()).toContain("Иммунитет");
  });

  it("торс: успешный тест против загорания перебрасывается; не торс — нет", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 90, 3];
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "torso" });
    expect(lastCard()).toContain("Поджигатель: успех против загорания (10)");
    expect(lastCard()).toContain("эффект наложен");
    resetCaptured();
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 90, 3];
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "arm" });
    expect(lastCard()).not.toContain("Поджигатель: успех");
    expect(lastCard()).toContain("сопротивилась");
  });

  it("рука: загорелась и провалила W+0 — кнопки «Выронить» обеих рук; устояла — нет", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [90, 95, 3];                       // A провален → загорелась; W+0 (40) провален; урон
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "arm" });
    expect(lastCard()).toContain("Поджигатель: тест W+0");
    expect(lastCard()).toContain("wh-crit-drop-btn");
    expect(lastCard()).toContain('data-side="right"');
    expect(lastCard()).toContain('data-side="left"');
    resetCaptured();
    globalThis.fromUuid = async () => target();
    captured.dice = [90, 10, 3];                       // W+0 пройден
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "arm" });
    expect(lastCard()).toContain("устояла");
    expect(lastCard()).not.toContain("wh-crit-drop-btn");
  });

  it("рука/нога: если цель НЕ загорелась (тест A пройден) — W+0 не бросается", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 20];                          // A пройден, переброса нет у руки
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "leg" });
    expect(lastCard()).not.toContain("Поджигатель: тест W+0");
  });

  it("нога: загорелась и провалила W+0 — Сбита с ног; прошла — стоит", async () => {
    const fallen = target();
    globalThis.fromUuid = async () => fallen;
    captured.dice = [90, 95, 3];
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "leg" });
    expect(lastCard()).toContain("Сбита с ног");
    expect(fallen.system.conditions.prone).toBeTruthy();
    resetCaptured();
    const standing = target();
    globalThis.fromUuid = async () => standing;
    captured.dice = [90, 10, 3];
    await _applyWeaponPropEffect({ ...burn, wpIgniter: "leg" });
    expect(standing.system.conditions.prone).toBeFalsy();
  });
});
