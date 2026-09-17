// test/rules/unseen-attack.test.mjs
//
// wdbc-1rno.2: isUnseenAttack (wp.unseen), hasWarpSight (по имени
// «Warp Sight / Варп-Зрение», trait ИЛИ talent), isUnseenDetected
// (персистентный флаг ИЛИ пассивное Варп-Зрение против психических
// источников), markUnseenDetectedUntilNextTurn/clearUnseenDetection.
// Фейковый актор с минимальным getFlag/setFlag/unsetFlag, без foundry-stub.

import { describe, it, expect } from "vitest";
import {
  isUnseenAttack, hasWarpSight, hasRadiationDetection, isUnseenDetected,
  markUnseenDetectedUntilNextTurn, clearUnseenDetection
} from "../../module/rules/unseen-attack.mjs";

function fakeActor(items = []) {
  const flags = {};
  return {
    items,
    getFlag: (ns, key) => flags[key],
    setFlag: async (ns, key, value) => { flags[key] = value; },
    unsetFlag: async (ns, key) => { delete flags[key]; },
    _flags: flags
  };
}

describe("isUnseenAttack", () => {
  it("wp.unseen true — true", () => {
    expect(isUnseenAttack({ unseen: true })).toBe(true);
  });
  it("wp.unseen отсутствует/false — false", () => {
    expect(isUnseenAttack({})).toBe(false);
    expect(isUnseenAttack(null)).toBe(false);
  });
});

describe("hasWarpSight", () => {
  it("trait «Warp Sight / Варп-Зрение» — true", () => {
    const actor = fakeActor([{ type: "trait", name: "Warp Sight / Варп-Зрение" }]);
    expect(hasWarpSight(actor)).toBe(true);
  });
  it("talent «Дар: Варп-Зрение» (одержимые) — true, itemHasName по русской половине", () => {
    const actor = fakeActor([{ type: "talent", name: "Warp Sight / Дар: Варп-Зрение" }]);
    expect(hasWarpSight(actor)).toBe(true);
  });
  it("предмет другого типа с тем же именем (напр. психосила) — не считается", () => {
    const actor = fakeActor([{ type: "psychicPower", name: "Warp Sight / Варп-Зрение" }]);
    expect(hasWarpSight(actor)).toBe(false);
  });
  it("нет такого предмета — false", () => {
    expect(hasWarpSight(fakeActor([]))).toBe(false);
    expect(hasWarpSight(null)).toBe(false);
  });
});

describe("hasRadiationDetection", () => {
  it("Electroepithany, sustained=true — true", () => {
    const actor = fakeActor([{ type: "techPower", name: "Electroepithany / Электропрозрение", system: { sustained: true } }]);
    expect(hasRadiationDetection(actor)).toBe(true);
  });
  it("Electroepithany есть, но НЕ sustained — false (активируемое, не пассивное)", () => {
    const actor = fakeActor([{ type: "techPower", name: "Electroepithany / Электропрозрение", system: { sustained: false } }]);
    expect(hasRadiationDetection(actor)).toBe(false);
  });
  it("предмет другого типа с тем же именем — не считается", () => {
    const actor = fakeActor([{ type: "trait", name: "Electroepithany / Электропрозрение", system: { sustained: true } }]);
    expect(hasRadiationDetection(actor)).toBe(false);
  });
  it("нет предмета — false", () => {
    expect(hasRadiationDetection(fakeActor([]))).toBe(false);
    expect(hasRadiationDetection(null)).toBe(false);
  });
});

describe("isUnseenDetected", () => {
  it("без флага и без Варп-Зрения — false", () => {
    expect(isUnseenDetected(fakeActor())).toBe(false);
  });

  it("персистентный флаг — true независимо от isPsychic", () => {
    const actor = fakeActor();
    actor._flags.unseenDetectedUntilNextTurn = true;
    expect(isUnseenDetected(actor)).toBe(true);
    expect(isUnseenDetected(actor, { isPsychic: true })).toBe(true);
  });

  it("Варп-Зрение без isPsychic — не засекает (только психические источники)", () => {
    const actor = fakeActor([{ type: "trait", name: "Warp Sight / Варп-Зрение" }]);
    expect(isUnseenDetected(actor)).toBe(false);
  });

  it("Варп-Зрение + isPsychic — true, без теста и без флага", () => {
    const actor = fakeActor([{ type: "trait", name: "Warp Sight / Варп-Зрение" }]);
    expect(isUnseenDetected(actor, { isPsychic: true })).toBe(true);
  });

  it("Электропрозрение (sustained) + isRadiation — true, без теста и без флага", () => {
    const actor = fakeActor([{ type: "techPower", name: "Electroepithany / Электропрозрение", system: { sustained: true } }]);
    expect(isUnseenDetected(actor, { isRadiation: true })).toBe(true);
    expect(isUnseenDetected(actor)).toBe(false);
  });
});

describe("markUnseenDetectedUntilNextTurn / clearUnseenDetection", () => {
  it("mark → isUnseenDetected true; clear → снова false", async () => {
    const actor = fakeActor();
    await markUnseenDetectedUntilNextTurn(actor);
    expect(isUnseenDetected(actor)).toBe(true);
    await clearUnseenDetection(actor);
    expect(isUnseenDetected(actor)).toBe(false);
  });

  it("clear без флага — ничего не бросает", async () => {
    const actor = fakeActor();
    await expect(clearUnseenDetection(actor)).resolves.not.toThrow();
  });
});
