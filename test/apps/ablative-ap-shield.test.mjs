// test/apps/ablative-ap-shield.test.mjs
//
// wdbc-bxw6: активация и угасание аблативного AP-щита (Роба Чемпиона).
// Сама трата 1 тPR НЕ автоматизирована (см. комментарий в самом модуле) —
// activateAblativeApShield лишь поднимает пул после того, как размен уже
// состоялся за столом. decayAblativeApShieldOnNewRound — угасание 1d5+1 в
// начале нового Раунда, вызывается из hooks.mjs::updateCombat.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { activateAblativeApShield, decayAblativeApShieldOnNewRound } from "../../module/apps/ablative-ap-shield.mjs";

function actorWithShield(value) {
  const system = { ablativeApShield: { value, max: value } };
  return {
    system,
    async update(data) {
      if (data["system.ablativeApShield.value"] !== undefined) system.ablativeApShield.value = data["system.ablativeApShield.value"];
      if (data["system.ablativeApShield.max"]   !== undefined) system.ablativeApShield.max   = data["system.ablativeApShield.max"];
    }
  };
}

beforeEach(resetCaptured);

describe("activateAblativeApShield", () => {
  it("поднимает value и max до amount (умолчание 2)", async () => {
    const actor = actorWithShield(0);
    await activateAblativeApShield(actor);
    expect(actor.system.ablativeApShield).toEqual({ value: 2, max: 2 });
  });

  it("принимает произвольную величину", async () => {
    const actor = actorWithShield(0);
    await activateAblativeApShield(actor, 5);
    expect(actor.system.ablativeApShield).toEqual({ value: 5, max: 5 });
  });
});

describe("decayAblativeApShieldOnNewRound", () => {
  it("уменьшает щит на 1d5+1 у каждого комбатанта с ненулевым щитом", async () => {
    captured.dice = [3]; // 1d5+1 = 3+1 = 4
    const actor = actorWithShield(10);
    const combat = { combatants: [{ actor }] };
    await decayAblativeApShieldOnNewRound(combat);
    expect(actor.system.ablativeApShield.value).toBe(6);
  });

  it("не уходит ниже нуля", async () => {
    captured.dice = [5]; // 1d5+1 = 6
    const actor = actorWithShield(2);
    const combat = { combatants: [{ actor }] };
    await decayAblativeApShieldOnNewRound(combat);
    expect(actor.system.ablativeApShield.value).toBe(0);
  });

  it("комбатант с уже нулевым щитом не бросает кубик вовсе", async () => {
    const actor = actorWithShield(0);
    const combat = { combatants: [{ actor }] };
    await decayAblativeApShieldOnNewRound(combat);
    expect(captured.rolls).toEqual([]);
  });
});
