// test/hooks-weapon-prop-burning-source-damage.test.mjs
//
// wdbc-3pv5 (Cooler/Охладитель + Морозное Сердце): порог книги «пламя,
// которым объят персонаж, наносит не больше 1d10 урона» нечем было сравнить —
// Горение не хранило урон ПОДЖИГАНИЯ вовсе. Свойство Flame уже считает этот
// урон при накладывании Горения (damageFromRating → «Доп. урон минуя броню»
// блок в _applyWeaponPropEffect) — этот тест проверяет, что то же число
// теперь ещё и сохраняется в system.conditions.burningSourceDamage, а не
// только тратится на applyWoundLoss.

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";

const { _applyWeaponPropEffect } = await import("../module/hooks.mjs");

beforeEach(() => {
  resetCaptured();
});

function forcedActor({ burning = false } = {}) {
  const system = { characteristics: {}, conditions: { burning } };
  return {
    uuid: "Actor.forced1", name: "Цель", isOwner: true, type: "character",
    system,
    // Мутирует system.conditions.* дотированным ключом — ровно то, что читает
    // _applyWeaponPropEffect сразу после первого actor.update() (проверка
    // «Горение реально наложилось, не погашено иммунитетом»).
    update: async (changes) => {
      captured.updates.push(changes);
      for (const [key, value] of Object.entries(changes)) {
        if (key.startsWith("system.conditions.")) {
          system.conditions[key.slice("system.conditions.".length)] = value;
        }
      }
    }
  };
}

describe("_applyWeaponPropEffect: Горение запоминает урон поджигания (wdbc-3pv5)", () => {
  it("Огонь (flame) поджигает — burningSourceDamage получает тот же dmg, что применён к Ранам", async () => {
    const actor = forcedActor();
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Огонь", wpKey: "flame", wpCondition: "burning",
      wpTestChar: "ag", wpTestMod: "0", wpDamage: "1d10"
    });

    expect(actor.system.conditions.burning).toBe(true);
    expect(actor.system.conditions.burningSourceDamage).toBe(captured.nextRoll);
  });

  it("тест сопротивления пройден (сопротивился) — Горение не накладывается, burningSourceDamage не трогается", async () => {
    const actor = forcedActor();
    actor.system.characteristics.ag = { total: 100 }; // выше любого разумного nextRoll — сопротивился
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Огонь", wpKey: "flame", wpCondition: "burning",
      wpTestChar: "ag", wpTestMod: "0", wpDamage: "1d10"
    });

    expect(actor.system.conditions.burning).toBe(false);
    expect(actor.system.conditions.burningSourceDamage).toBeUndefined();
  });

  it("другое свойство (Токсичное) с доп. уроном не трогает burningSourceDamage вовсе", async () => {
    const actor = forcedActor();
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Токсичное", wpKey: "toxic", wpCondition: "poisoned",
      wpTestChar: "t", wpTestMod: "0", wpDamage: "1d10"
    });

    expect(actor.system.conditions.burningSourceDamage).toBeUndefined();
  });
});
