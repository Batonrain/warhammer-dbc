// test/hooks-weapon-prop-permission.test.mjs
//
// wdbc-5tz: module/hooks.mjs::_applyWeaponPropEffect с data-wp-force-actor-uuid
// (Встречная атака — Shocking, wdbc-z5mn) резолвил актора по uuid НАПРЯМУЮ,
// без requireControlledActor и без проверки прав — actor.update() ниже по
// коду мог упасть сырой ошибкой прав Foundry уже ПОСЛЕ броска (кнопку видит
// каждый со сцены, но менять чужого актора может не каждый). Здесь
// проверяется, что доступ отсекается ДО броска, понятным предупреждением, а
// владельцу/ГМ путь остаётся открыт.

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";

const { _applyWeaponPropEffect } = await import("../module/hooks.mjs");

beforeEach(() => {
  resetCaptured();
});

/** Актор-цель forceActor: без прав по умолчанию, минимум для теста-сопротивления. */
function forcedActor({ isOwner = false } = {}) {
  return {
    uuid: "Actor.forced1",
    name: "Атакующий",
    isOwner,
    type: "character",
    system: { characteristics: {} },
    update: async (changes) => { captured.updates.push(changes); }
  };
}

describe("_applyWeaponPropEffect: forceActor без прав на изменение", () => {
  it("нет прав (isOwner:false) — предупреждение ДО броска, ни кубов, ни update, ни карточки", async () => {
    const actor = forcedActor({ isOwner: false });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid,
      wpLabel: "Шокирующее", wpKey: "shocking", wpCondition: "stunned", wpTestChar: "t"
    });

    expect(captured.warnings.some(w => w.includes("Нет прав") && w.includes(actor.name))).toBe(true);
    expect(captured.rolls.length).toBe(0);
    expect(captured.updates.length).toBe(0);
    expect(captured.chat.length).toBe(0);
  });

  it("есть права (isOwner:true) — проходит дальше и постит карточку теста", async () => {
    const actor = forcedActor({ isOwner: true });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid,
      wpLabel: "Шокирующее", wpKey: "shocking"
    });

    expect(captured.warnings.some(w => w.includes("Нет прав"))).toBe(false);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("цель не найдена по uuid — обычное предупреждение, не про права", async () => {
    globalThis.fromUuid = async () => null;

    await _applyWeaponPropEffect({ wpForceActorUuid: "Actor.gone", wpLabel: "Эффект" });

    expect(captured.warnings.some(w => w.includes("не найдена"))).toBe(true);
    expect(captured.warnings.some(w => w.includes("Нет прав"))).toBe(false);
  });
});
