// test/hooks-weapon-prop-required-successes.test.mjs
//
// wdbc-zlx7 (Force Bolt): «требование удваивается за каждый уровень Размера
// цели >0» — базовый порог Успехов уже отфильтрован до постройки кнопки
// (filterPropsBySuccesses, module/combat/weapon-properties.mjs), но Размер
// КОНКРЕТНОЙ цели известен только здесь, в момент клика по кнопке
// (_applyWeaponPropEffect, module/hooks.mjs) — тот же приём, что у
// hooks-weapon-prop-permission.test.mjs (forceActor напрямую, без DOM).

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";

const { _applyWeaponPropEffect } = await import("../module/hooks.mjs");

beforeEach(() => {
  resetCaptured();
});

function forcedActor({ size = 0 } = {}) {
  return {
    uuid: "Actor.forced1", name: "Цель", isOwner: true, type: "character",
    system: { characteristics: {}, size },
    update: async (changes) => { captured.updates.push(changes); }
  };
}

describe("_applyWeaponPropEffect: requiredSuccessesScalesSize (wdbc-zlx7)", () => {
  it("Размер 0, порог 3, deg 3 — проходит (3×2^0=3)", async () => {
    const actor = forcedActor({ size: 0 });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Сбивание с ног", wpKey: "knockdown",
      wpCondition: "prone", wpRequiredSuccesses: "3", wpRequiredSuccessesSize: "1", wpDeg: "3"
    });

    expect(captured.chat.some(c => c.content.includes("Недостаточно Успехов"))).toBe(false);
    expect(captured.updates.length).toBeGreaterThan(0);
  });

  it("Размер 1, порог 3 (эффективно 6), deg 5 — отказ ДО броска/применения, честное сообщение", async () => {
    const actor = forcedActor({ size: 1 });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Сбивание с ног", wpKey: "knockdown",
      wpCondition: "prone", wpRequiredSuccesses: "3", wpRequiredSuccessesSize: "1", wpDeg: "5"
    });

    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Недостаточно Успехов");
    expect(note).toContain("6+"); // 3 × 2^1
    expect(note).toContain("было 5");
    expect(captured.updates.length).toBe(0);
    expect(captured.rolls.length).toBe(0);
  });

  it("Размер 1, порог 3, deg 6 — ровно на пороге, проходит", async () => {
    const actor = forcedActor({ size: 1 });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Сбивание с ног", wpKey: "knockdown",
      wpCondition: "prone", wpRequiredSuccesses: "3", wpRequiredSuccessesSize: "1", wpDeg: "6"
    });

    expect(captured.chat.some(c => c.content.includes("Недостаточно Успехов"))).toBe(false);
    expect(captured.updates.length).toBeGreaterThan(0);
  });

  it("Размер 2, порог 3 (эффективно 12), deg 6 — отказ", async () => {
    const actor = forcedActor({ size: 2 });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Сбивание с ног", wpKey: "knockdown",
      wpCondition: "prone", wpRequiredSuccesses: "3", wpRequiredSuccessesSize: "1", wpDeg: "6"
    });

    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("12+"); // 3 × 2^2
  });

  it("wpRequiredSuccessesSize не задан («0»/отсутствует) — масштаб НЕ применяется, даже при большом Размере", async () => {
    const actor = forcedActor({ size: 3 });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Токсичное", wpKey: "toxic",
      wpCondition: "poisoned", wpRequiredSuccesses: "3", wpDeg: "1"
      // wpRequiredSuccessesSize отсутствует — свойства без Force Bolt-подобного масштаба не задеты.
    });

    expect(captured.chat.some(c => c.content.includes("Недостаточно Успехов"))).toBe(false);
  });

  it("wpRequiredSuccesses не задан (обычное свойство без порога) — проверка вообще не запускается", async () => {
    const actor = forcedActor({ size: 5 });
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Шокирующее", wpKey: "shocking",
      wpCondition: "stunned", wpDeg: "0"
    });

    expect(captured.chat.some(c => c.content.includes("Недостаточно Успехов"))).toBe(false);
  });
});
