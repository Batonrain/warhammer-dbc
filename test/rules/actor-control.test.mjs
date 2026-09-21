// test/rules/actor-control.test.mjs
import { describe, it, expect } from "vitest";
import {
  controlOf, isControlExpired, isControlled, controllerUuidOf, buildControlFlag,
  establishControl, releaseControl, releaseControlOnCombatEnd, sweepExpiredControl
} from "../../module/rules/actor-control.mjs";

/** Актор с getFlag/setFlag/unsetFlag хранилищем — тот же приём, что attacker() в test/combat/defense.test.mjs. */
function mockActor(overrides = {}) {
  const store = {};
  const actor = { ...overrides };
  actor.getFlag = (scope, key) => store[`${scope}.${key}`];
  actor.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  actor.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return actor;
}

describe("buildControlFlag", () => {
  it("permanent — без unit/дедлайнов", () => {
    const flag = buildControlFlag("Actor.ctrl", { permanent: true, unit: "round", durationValue: 5 });
    expect(flag).toEqual({ controllerUuid: "Actor.ctrl", sourceItemUuid: "", permanent: true, unit: "" });
  });
  it("worldTime — expiresAt = worldTime + durationValue", () => {
    const flag = buildControlFlag("Actor.ctrl", { unit: "worldTime", durationValue: 3600, worldTime: 1000, sourceItemUuid: "Item.x" });
    expect(flag).toMatchObject({ controllerUuid: "Actor.ctrl", sourceItemUuid: "Item.x", permanent: false, unit: "worldTime", expiresAt: 4600 });
  });
  it("round — combatId + expiresAtRound относительно текущего Раунда", () => {
    const flag = buildControlFlag("Actor.ctrl", { unit: "round", durationValue: 3, combat: { id: "c1", round: 2 } });
    expect(flag).toMatchObject({ unit: "round", combatId: "c1", expiresAtRound: 5 });
  });
  it("battle — только combatId, без числового дедлайна", () => {
    const flag = buildControlFlag("Actor.ctrl", { unit: "battle", combat: { id: "c1", round: 2 } });
    expect(flag).toMatchObject({ unit: "battle", combatId: "c1" });
    expect(flag.expiresAt).toBeUndefined();
    expect(flag.expiresAtRound).toBeUndefined();
  });
});

describe("isControlExpired / isControlled", () => {
  it("нет флага — истёк (не контролируется)", () => {
    expect(isControlExpired(null)).toBe(true);
  });
  it("permanent — никогда не истекает", () => {
    expect(isControlExpired({ permanent: true })).toBe(false);
  });
  it("battle — никогда не истекает сравнением (снимается хуком отдельно)", () => {
    expect(isControlExpired({ unit: "battle", combatId: "c1" })).toBe(false);
  });
  it("worldTime — истекает по дедлайну (переиспользует isTempGrantExpired)", () => {
    const control = { unit: "worldTime", expiresAt: 1000 };
    expect(isControlExpired(control, { worldTime: 999 })).toBe(false);
    expect(isControlExpired(control, { worldTime: 1000 })).toBe(true);
  });
  it("round — истекает по Раунду того же боя, другой/нет боя — истёк сразу", () => {
    const control = { unit: "round", combatId: "c1", expiresAtRound: 5 };
    expect(isControlExpired(control, { combat: { id: "c1", round: 5 } })).toBe(false);
    expect(isControlExpired(control, { combat: { id: "c1", round: 6 } })).toBe(true);
    expect(isControlExpired(control, { combat: { id: "c2", round: 1 } })).toBe(true);
    expect(isControlExpired(control, {})).toBe(true);
  });
});

describe("establishControl / releaseControl / controllerUuidOf", () => {
  it("установить и снять контроль", async () => {
    const target = mockActor();
    await establishControl(target, "Actor.ctrl", { permanent: true, sourceItemUuid: "Item.wire" });
    expect(isControlled(target)).toBe(true);
    expect(controllerUuidOf(target)).toBe("Actor.ctrl");
    expect(controlOf(target)).toMatchObject({ controllerUuid: "Actor.ctrl", sourceItemUuid: "Item.wire" });

    await releaseControl(target);
    expect(isControlled(target)).toBe(false);
    expect(controllerUuidOf(target)).toBe(null);
  });

  it("controllerUuidOf — null, если контроль истёк, хотя флаг физически ещё на месте", async () => {
    const target = mockActor();
    await establishControl(target, "Actor.ctrl", { unit: "worldTime", durationValue: 100, worldTime: 0 });
    expect(controllerUuidOf(target, { worldTime: 50 })).toBe("Actor.ctrl");
    expect(controllerUuidOf(target, { worldTime: 200 })).toBe(null);
  });
});

describe("releaseControlOnCombatEnd", () => {
  it("снимает только unit:battle этого же боя, остальных не трогает", async () => {
    const battleTarget = mockActor();
    await establishControl(battleTarget, "Actor.a", { unit: "battle", combat: { id: "c1", round: 1 } });
    const otherBattleTarget = mockActor();
    await establishControl(otherBattleTarget, "Actor.b", { unit: "battle", combat: { id: "c2", round: 1 } });
    const permanentTarget = mockActor();
    await establishControl(permanentTarget, "Actor.c", { permanent: true });

    const combat = { id: "c1", combatants: [
      { actor: battleTarget }, { actor: otherBattleTarget }, { actor: permanentTarget }
    ] };
    await releaseControlOnCombatEnd(combat);

    expect(isControlled(battleTarget)).toBe(false);
    expect(isControlled(otherBattleTarget)).toBe(true); // другой бой — не тронут
    expect(isControlled(permanentTarget)).toBe(true);   // permanent — не тронут
  });
});

describe("sweepExpiredControl", () => {
  it("снимает истёкший worldTime-контроль", async () => {
    const target = mockActor();
    await establishControl(target, "Actor.a", { unit: "worldTime", durationValue: 100, worldTime: 0 });
    await sweepExpiredControl(target, { worldTime: 200 });
    expect(isControlled(target)).toBe(false);
  });
  it("не трогает permanent/battle/еще-не-истёкший", async () => {
    const permanentTarget = mockActor();
    await establishControl(permanentTarget, "Actor.a", { permanent: true });
    await sweepExpiredControl(permanentTarget, { worldTime: 999999 });
    expect(isControlled(permanentTarget)).toBe(true);

    const notYet = mockActor();
    await establishControl(notYet, "Actor.a", { unit: "worldTime", durationValue: 100, worldTime: 0 });
    await sweepExpiredControl(notYet, { worldTime: 50 });
    expect(isControlled(notYet)).toBe(true);
  });
});
