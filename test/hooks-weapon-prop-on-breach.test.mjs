// test/hooks-weapon-prop-on-breach.test.mjs
//
// wdbc-x1nz.2.79: Rad/Toxic/Сновидение/Погибель срабатывают «при пробитии
// брони» (core.json стр. 42 и тексты свойств). Кнопка эффекта строится ДО
// применения урона, поэтому проверка — в hooks.mjs::_applyWeaponPropEffect по
// итогу, который combat/damage.mjs записал во flags.lastBreach цели.

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { WEAPON_PROPERTIES } from "../module/constants/weapon-properties.mjs";

const { _applyWeaponPropEffect } = await import("../module/hooks.mjs");

beforeEach(() => { resetCaptured(); });

function target({ lastBreach = null, type = "character" } = {}) {
  return {
    uuid: "Actor.t1", name: "Цель", isOwner: true, type,
    system: { characteristics: { t: { total: 30 } } },
    getFlag: (_s, k) => (k === "lastBreach" ? lastBreach : undefined),
    update: async (changes) => { captured.updates.push(changes); }
  };
}

const toxicBtn = (actor) => ({
  wpForceActorUuid: actor.uuid, wpLabel: "Токсичное", wpKey: "toxic",
  wpCondition: "poisoned", wpTestChar: "t", wpOnBreach: "1"
});

describe("эффект «при пробитии брони»", () => {
  it("Rad/Toxic/Сновидение/Погибель помечены onBreach", () => {
    for (const k of ["rad", "toxic", "dreaming", "bane"]) {
      expect(WEAPON_PROPERTIES[k].auto.targetEffect.onBreach).toBe(true);
    }
  });

  it("урон этой карточки ещё не применён — предупреждение, без броска", async () => {
    const actor = target({ lastBreach: { messageId: "other", breached: true } });
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect(toxicBtn(actor), { messageId: "msg1" });
    expect(captured.warnings.some(w => w.includes("сначала примените урон"))).toBe(true);
    expect(captured.rolls.length).toBe(0);
  });

  it("броня не пробита — карточка «не применён», без броска", async () => {
    const actor = target({ lastBreach: { messageId: "msg1", breached: false } });
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect(toxicBtn(actor), { messageId: "msg1" });
    expect(captured.rolls.length).toBe(0);
    expect(captured.chat.some(c => String(c.content).includes("Броня не пробита"))).toBe(true);
  });

  it("броня пробита — тест сопротивления бросается", async () => {
    const actor = target({ lastBreach: { messageId: "msg1", breached: true } });
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect(toxicBtn(actor), { messageId: "msg1" });
    expect(captured.rolls.length).toBeGreaterThan(0);
  });

  it("Shift (force) — ГМ накладывает вручную без проверки", async () => {
    const actor = target({ lastBreach: null });
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect(toxicBtn(actor), { messageId: "msg1", force: true });
    expect(captured.rolls.length).toBeGreaterThan(0);
  });

  it("свойство без onBreach не проверяется", async () => {
    const actor = target({ lastBreach: null });
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect({ ...toxicBtn(actor), wpOnBreach: "0" }, { messageId: "msg1" });
    expect(captured.rolls.length).toBeGreaterThan(0);
  });
});

// wdbc-x1nz.10: Rad (X) по книге (core.json, Особые Свойства Оружия): «Если
// оно пробило броню цели, она получает X урона в T» — без теста T и без
// порога «непоглощённый урон ≥ X», которых в книге нет.
describe("Rad (X): X урона в T при пробитии, без теста", () => {
  function radTarget({ lastBreach = { messageId: "msg1", breached: true }, type = "character" } = {}) {
    const flags = { lastBreach };
    const actor = {
      uuid: "Actor.r1", name: "Облучаемый", isOwner: true, type, items: [],
      system: { characteristics: { t: { total: 40 } }, charLoss: { t: 0 }, charLossAt: {}, conditions: {} },
      getFlag: (_s, k) => flags[k],
      update: async (changes) => {
        captured.updates.push(changes);
        if ("system.charLoss.t" in changes) actor.system.charLoss.t = changes["system.charLoss.t"];
      }
    };
    return actor;
  }
  const radBtn = (actor, damage = "1d5") => ({
    wpForceActorUuid: actor.uuid, wpLabel: "Рад", wpKey: "rad",
    wpRadiation: "1", wpDamage: damage, wpOnBreach: "1"
  });

  it("свойство: рейтинг — формула, ни теста, ни Состояния", () => {
    const def = WEAPON_PROPERTIES.rad;
    expect(def.ratingDice).toBe(true);
    const te = def.auto.targetEffect;
    expect(te.radiation).toBe(true);
    expect(te.damageFromRating).toBe(true);
    expect(te.testChar).toBeUndefined();
    expect(te.condition).toBeUndefined();
    expect(def.desc).not.toMatch(/непоглощ/u);
  });

  it("кнопка несёт формулу X и признак радиации", async () => {
    const { buildTargetEffectButtons } = await import("../module/combat/weapon-properties.mjs");
    const html = buildTargetEffectButtons([{ def: WEAPON_PROPERTIES.rad, rating: "2d10" }], { hit: true });
    expect(html).toContain('data-wp-damage="2d10"');
    expect(html).toContain('data-wp-radiation="1"');
    expect(html).toContain('data-wp-test-char=""');
  });

  it("броня пробита — бросается только X, урон уходит в T, Ран не трогает", async () => {
    const actor = radTarget();
    globalThis.fromUuid = async () => actor;
    captured.dice = [4];
    await _applyWeaponPropEffect(radBtn(actor), { messageId: "msg1" });
    expect(captured.rolls).toEqual(["1d5"]);
    expect(actor.system.charLoss.t).toBe(4);
    expect(captured.updates.some(u => Object.keys(u).some(k => k.startsWith("system.wounds")))).toBe(false);
    expect(captured.updates.some(u => Object.keys(u).some(k => k.startsWith("system.conditions")))).toBe(false);
  });

  it("броня не пробита — урона в T нет", async () => {
    const actor = radTarget({ lastBreach: { messageId: "msg1", breached: false } });
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect(radBtn(actor), { messageId: "msg1" });
    expect(captured.rolls.length).toBe(0);
    expect(actor.system.charLoss.t).toBe(0);
  });

  it("рейтинг X не задан у оружия — предупреждение, без броска", async () => {
    const actor = radTarget();
    globalThis.fromUuid = async () => actor;
    await _applyWeaponPropEffect(radBtn(actor, ""), { messageId: "msg1" });
    expect(captured.rolls.length).toBe(0);
    expect(captured.warnings.some(w => w.includes("Рад"))).toBe(true);
  });
});
