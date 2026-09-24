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
