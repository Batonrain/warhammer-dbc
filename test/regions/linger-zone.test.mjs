// test/regions/linger-zone.test.mjs
//
// module/regions/linger-zone.mjs — свойство оружия «Остаётся» (Linger):
// персистентная зона, живущая «X ходов стрелка», с опциональным дрейфом на
// Y метров. Большая часть файла — canvas-обвязка (region/scene/Roll), не
// тестируется напрямую по тому же прецеденту, что auras.mjs (см.
// test/regions/auras.test.mjs) — здесь тестируется только сама ветвящаяся
// логика processShooterTurnStart через мок-объекты сцены/региона/поведения
// (тот же приём мок-DOM, что test/sheets/combat.test.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LINGER_ZONE_TYPE, processShooterTurnStart } from "../../module/regions/linger-zone.mjs";

const ATTACKER = "Actor.attacker123456";

function fakeBehavior({ turnsPassed = 0, roundsTotal = 1, driftMeters = 0, attackerUuid = ATTACKER, disabled = false } = {}) {
  return {
    type: LINGER_ZONE_TYPE, disabled,
    system: {
      turnsPassed, roundsTotal, driftMeters,
      damageData: { attackerUuid },
      _drift: vi.fn().mockResolvedValue(undefined)
    },
    update: vi.fn().mockResolvedValue(undefined)
  };
}

function fakeScene(regions) {
  return {
    regions,
    deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
  };
}

function fakeCombatant(scene) {
  return { actor: { uuid: ATTACKER }, combat: { scene } };
}

beforeEach(() => {
  globalThis.game = { ...globalThis.game, user: { isGM: true } };
});

describe("processShooterTurnStart", () => {
  it("не-ГМ — ничего не делает", async () => {
    globalThis.game.user.isGM = false;
    const behavior = fakeBehavior();
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(behavior.update).not.toHaveBeenCalled();
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("без актора у combatant — ничего не делает", async () => {
    const behavior = fakeBehavior();
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart({ actor: null, combat: { scene } });
    expect(behavior.update).not.toHaveBeenCalled();
  });

  it("зона другого стрелка (attackerUuid не совпадает) — не трогается", async () => {
    const behavior = fakeBehavior({ attackerUuid: "Actor.someoneElse" });
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(behavior.update).not.toHaveBeenCalled();
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("отключённое поведение — не трогается", async () => {
    const behavior = fakeBehavior({ disabled: true });
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(behavior.update).not.toHaveBeenCalled();
  });

  it("roundsTotal ещё не исчерпан, дрейфа нет (driftMeters:0) — только инкремент turnsPassed", async () => {
    const behavior = fakeBehavior({ turnsPassed: 0, roundsTotal: 3, driftMeters: 0 });
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(behavior.update).toHaveBeenCalledWith({ "system.turnsPassed": 1 });
    expect(behavior.system._drift).not.toHaveBeenCalled();
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("roundsTotal не исчерпан, driftMeters > 0 — инкремент И дрейф", async () => {
    const behavior = fakeBehavior({ turnsPassed: 0, roundsTotal: 3, driftMeters: 5 });
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(behavior.update).toHaveBeenCalledWith({ "system.turnsPassed": 1 });
    expect(behavior.system._drift).toHaveBeenCalledOnce();
  });

  it("turnsPassed достигает roundsTotal — зона удаляется, без инкремента/дрейфа", async () => {
    const behavior = fakeBehavior({ turnsPassed: 2, roundsTotal: 3, driftMeters: 5 });
    const scene = fakeScene([{ id: "r1", behaviors: [behavior] }]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledWith("Region", ["r1"]);
    expect(behavior.update).not.toHaveBeenCalled();
    expect(behavior.system._drift).not.toHaveBeenCalled();
  });

  it("несколько зон одного стрелка на сцене — каждая обрабатывается независимо", async () => {
    const expiring = fakeBehavior({ turnsPassed: 0, roundsTotal: 1 }); // истекает сразу
    const surviving = fakeBehavior({ turnsPassed: 0, roundsTotal: 5 });
    const scene = fakeScene([
      { id: "r1", behaviors: [expiring] },
      { id: "r2", behaviors: [surviving] }
    ]);
    await processShooterTurnStart(fakeCombatant(scene));
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledWith("Region", ["r1"]);
    expect(surviving.update).toHaveBeenCalledWith({ "system.turnsPassed": 1 });
  });
});
