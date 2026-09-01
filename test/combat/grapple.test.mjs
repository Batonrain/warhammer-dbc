// test/combat/grapple.test.mjs
//
// Борьба (стр. 12): успешный Приём «Захват» связывает атакующего и цель —
// conditions.grappling на обоих + взаимный флаг партнёра.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyGrappleOnHit, grapplePartner, endGrapple, isBiteWeapon, crunchWeapon, tentacleTechDef } from "../../module/combat/grapple.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";

const FLAG = "warhammer-dbc";

function actorWith(name, uuid) {
  const flags = {};
  const updates = [];
  return {
    id: uuid, name, uuid,
    system: { conditions: { grappling: false } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (changes) => {
      updates.push(changes);
      // Флаги теперь едут тем же update: разобрать пути flags.<scope>.<key> и -=<key>.
      for (const [path, v] of Object.entries(changes)) {
        let m = path.match(/^flags\.[^.]+\.-=(.+)$/);
        if (m) { delete flags[m[1]]; continue; }
        m = path.match(/^flags\.[^.]+\.(.+)$/);
        if (m) flags[m[1]] = v;
      }
      return changes;
    },
    _flags: flags, _updates: updates
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "roll" };
  globalThis.ChatMessage = {
    applyRollMode: (data) => data,
    create: async () => {},
    getSpeaker: ({ actor }) => ({ actor: actor?.id })
  };
  globalThis.fromUuidSync = () => null;
});

describe("applyGrappleOnHit", () => {
  it("связывает атакующего и цель Борьбой при попадании Приёмом «Захват»", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    const targetToken = { actor: target };

    await applyGrappleOnHit(attacker, targetToken, true, { technique: "grapple" });

    expect(attacker._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": true }));
    expect(target._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": true }));
    expect(attacker._flags.grapplePartnerUuid).toBe("Actor.t1");
    expect(target._flags.grapplePartnerUuid).toBe("Actor.a1");
  });

  it("не связывает при промахе", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    await applyGrappleOnHit(attacker, { actor: target }, false, { technique: "grapple" });
    expect(attacker._updates).toHaveLength(0);
    expect(target._updates).toHaveLength(0);
  });

  it("не связывает, если Приём — не «Захват»", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    await applyGrappleOnHit(attacker, { actor: target }, true, { technique: "standard" });
    expect(attacker._updates).toHaveLength(0);
    expect(target._updates).toHaveLength(0);
  });

  it("не связывает актора с самим собой", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    await applyGrappleOnHit(attacker, { actor: attacker }, true, { technique: "grapple" });
    expect(attacker._updates).toHaveLength(0);
  });
});

describe("grapplePartner / endGrapple", () => {
  it("находит партнёра по флагу через fromUuidSync", () => {
    const partner = { id: "p1", name: "Партнёр" };
    globalThis.fromUuidSync = (uuid) => (uuid === "Actor.p1" ? partner : null);
    const actor = actorWith("Актор", "Actor.a1");
    actor.getFlag = (_s, k) => (k === "grapplePartnerUuid" ? "Actor.p1" : undefined);
    expect(grapplePartner(actor)).toBe(partner);
  });

  it("возвращает null без флага партнёра", () => {
    const actor = actorWith("Актор", "Actor.a1");
    expect(grapplePartner(actor)).toBeNull();
  });

  it("endGrapple снимает состояние и флаг с обоих участников", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    globalThis.fromUuidSync = (uuid) => (uuid === "Actor.t1" ? target : null);
    attacker.getFlag = (_s, k) => (k === "grapplePartnerUuid" ? "Actor.t1" : undefined);

    await endGrapple(attacker);

    expect(attacker._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": false }));
    expect(target._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": false }));
  });
});

// wdbc-l07y: раньше /укус/i (только русская половина) — оружие, записанное
// одной английской половиной («Bite»), не находилось вовсе.
describe("isBiteWeapon", () => {
  it("находит по русской половине двуязычного имени", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bite / Укус" })).toBe(true);
  });

  it("находит по чисто английскому имени (раньше не находил)", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bite" })).toBe(true);
  });

  it("находит по чисто русскому имени", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Укус" })).toBe(true);
  });

  it("не оружие или не то оружие — нет", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bolt Pistol" })).toBe(false);
    expect(isBiteWeapon({ type: "implant", name: "Bite" })).toBe(false);
  });

  it("ranged/exotic класс оружия с этим именем не считается — только melee/пусто", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bite", system: { weaponClass: "ranged" } })).toBe(false);
    expect(isBiteWeapon({ type: "weapon", name: "Bite", system: { weaponClass: "melee" } })).toBe(true);
    expect(isBiteWeapon({ type: "weapon", name: "Bite", system: {} })).toBe(true);
  });
});

// wdbc-1d5u: auto.crunch (module/constants/weapon-properties.mjs) был заведён,
// но нигде не читался — crunchWeapon() смыкает Хруст с уже готовым
// aggregateAuto/resolveWeaponProps (тот же движок, что у диалога атаки).
describe("crunchWeapon", () => {
  const withProp = (key) => ({ type: "weapon", name: "Клешня", system: { weaponProps: [{ key }] } });

  it("оружие со свойством Crunch — да", () => {
    expect(crunchWeapon(withProp("crunch"))).toBe(true);
  });

  it("оружие без свойства Crunch — нет", () => {
    expect(crunchWeapon(withProp("tearing"))).toBe(false);
    expect(crunchWeapon({ type: "weapon", name: "Bolt Pistol", system: { weaponProps: [] } })).toBe(false);
  });

  it("не оружие — нет, даже если бы как-то нёс weaponProps", () => {
    expect(crunchWeapon({ type: "implant", name: "Клешня", system: { weaponProps: [{ key: "crunch" }] } })).toBe(false);
  });

  it("оружие без system/weaponProps вовсе — нет, не падает", () => {
    expect(crunchWeapon({ type: "weapon", name: "Голые руки" })).toBe(false);
  });
});

// wdbc-vkwe (продолжение): «...+20 на приём Захват и все тесты в Борьбе» —
// приём читается в attack-dialog.mjs (resolveSelection), а 5 РОЛЕВЫХ тестов
// раздела (Заломить/Пересилить/Вырваться/Выкрутиться/Перехватить Контроль,
// см. ALL_TESTS в grapple.mjs) — здесь, через tentacleTechDef перед вызовом
// _showContestDialog. Сжать/Хруст/Метнуть/Укусы броска не делают вовсе (см.
// шапку файла) — бонусу там нечего усиливать, поэтому в дело не идут.
describe("tentacleTechDef", () => {
  const DEFAULT_SOURCES = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("без мутации — techDef возвращается как есть", () => {
    const techDef = { label: "Заломить", defaultChar: "s" };
    expect(tentacleTechDef(actorFor({}), techDef)).toBe(techDef);
  });

  it("с mutation.tentacle — добавляет +20 и подпись «Щупальце»", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const techDef = { label: "Заломить", defaultChar: "s" };
    const result = tentacleTechDef(actorFor({}), techDef);
    expect(result.extraBonus).toBe(20);
    expect(result.extraBonusLabel).toBe("Щупальце");
    expect(result.label).toBe("Заломить"); // остальные поля techDef сохранены
  });

  it("складывается с уже существующим extraBonus, а не перезаписывает его", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const result = tentacleTechDef(actorFor({}), { extraBonus: 5 });
    expect(result.extraBonus).toBe(25);
  });

  it("не мутирует исходный techDef", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const techDef = { label: "Пересилить" };
    tentacleTechDef(actorFor({}), techDef);
    expect(techDef.extraBonus).toBeUndefined();
  });
});
