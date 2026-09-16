// test/apps/volunteer-actor.test.mjs
import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

const requestControlOwnership = vi.fn(async () => ({ ok: true }));
const requestRevokeControlOwnership = vi.fn(async () => ({ ok: true }));
vi.mock("../../module/apps/actor-control.mjs", () => ({
  requestControlOwnership: (...args) => requestControlOwnership(...args),
  requestRevokeControlOwnership: (...args) => requestRevokeControlOwnership(...args)
}));

import {
  captureWithMimicWire, cutMimicWire, startMimicWireSurgery,
  checkMimicWireSurgery, confirmMimicWireExtraction
} from "../../module/apps/volunteer-actor.mjs";
import { isControlled, controllerUuidOf } from "../../module/rules/actor-control.mjs";
import { MIMIC_WIRE_SURGERY_FLAG } from "../../module/rules/volunteer-actor.mjs";

function flaggedActor(overrides = {}) {
  const flags = {};
  const updates = [];
  return {
    id: "actor-1", name: "Жертва", uuid: "Actor.victim",
    system: { wounds: { value: 0, critical: 30 }, conditions: {} },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = flaggedActor._self;
        for (const part of parts.slice(0, -1)) { t[part] ??= {}; t = t[part]; }
        t[parts.at(-1)] = value;
      }
      return data;
    },
    updates,
    ...overrides
  };
}

beforeEach(() => {
  resetCaptured();
  game.time = { worldTime: 1000 };
  globalThis.fromUuid = async () => null;
  requestControlOwnership.mockClear();
  requestRevokeControlOwnership.mockClear();
});

describe("captureWithMimicWire", () => {
  it("1 Рана, mimicWire+блок сил, контроль установлен, обе кнопки в карточке", async () => {
    const attacker = { uuid: "Actor.attacker", name: "Мимик" };
    const target = flaggedActor();
    flaggedActor._self = target;

    await captureWithMimicWire(attacker, target, { blockPowers: true, sourceItemUuid: "Item.va" });

    const upd = target.updates.at(-1);
    expect(upd["system.wounds.value"]).toBe(1);
    expect(upd["system.wounds.critical"]).toBe(0);
    expect(upd["system.conditions.mimicWire"]).toBe(true);
    expect(upd["system.conditions.mimicWireBlocksPowers"]).toBe(true);

    expect(isControlled(target)).toBe(true);
    expect(controllerUuidOf(target)).toBe("Actor.attacker");
    expect(requestControlOwnership).toHaveBeenCalledWith(target, attacker);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-mimic-wire-cut-btn");
    expect(card).toContain("wh-mimic-wire-surgery-btn");
  });

  it("без blockPowers — mimicWireBlocksPowers остаётся false", async () => {
    const attacker = { uuid: "Actor.attacker", name: "Мимик" };
    const target = flaggedActor();
    flaggedActor._self = target;

    await captureWithMimicWire(attacker, target);

    expect(target.updates.at(-1)["system.conditions.mimicWireBlocksPowers"]).toBe(false);
  });
});

describe("cutMimicWire", () => {
  it("снимает контроль/флаг операции/Состояние, постит кнопку смерти", async () => {
    const attacker = { uuid: "Actor.attacker" };
    globalThis.fromUuid = async uuid => (uuid === "Actor.attacker" ? attacker : null);
    const target = flaggedActor();
    flaggedActor._self = target;
    await captureWithMimicWire(attacker, target);
    await startMimicWireSurgery(target);
    requestRevokeControlOwnership.mockClear();

    await cutMimicWire(target);

    expect(isControlled(target)).toBe(false);
    expect(target.getFlag("warhammer-dbc", MIMIC_WIRE_SURGERY_FLAG)).toBeUndefined();
    expect(target.updates.at(-1)["system.conditions.mimicWire"]).toBe(false);
    expect(requestRevokeControlOwnership).toHaveBeenCalled();

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-crit-death-btn");
  });
});

describe("startMimicWireSurgery / checkMimicWireSurgery", () => {
  it("ставит дедлайн +16ч, checkMimicWireSurgery молчит до срока", async () => {
    const target = flaggedActor();
    flaggedActor._self = target;
    await startMimicWireSurgery(target);
    expect(target.getFlag("warhammer-dbc", MIMIC_WIRE_SURGERY_FLAG)).toBe(1000 + 16 * 3600);

    resetCaptured();
    await checkMimicWireSurgery(target, 1000 + 16 * 3600 - 1);
    expect(captured.chat.length).toBe(0);
    expect(target.getFlag("warhammer-dbc", MIMIC_WIRE_SURGERY_FLAG)).toBe(1000 + 16 * 3600);
  });

  it("checkMimicWireSurgery на дедлайне — снимает флаг, постит кнопку подтверждения", async () => {
    const target = flaggedActor();
    flaggedActor._self = target;
    await startMimicWireSurgery(target);

    await checkMimicWireSurgery(target, 1000 + 16 * 3600);

    expect(target.getFlag("warhammer-dbc", MIMIC_WIRE_SURGERY_FLAG)).toBeUndefined();
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-mimic-wire-extract-btn");
  });
});

describe("confirmMimicWireExtraction", () => {
  it("снимает контроль/Состояние без смерти", async () => {
    const attacker = { uuid: "Actor.attacker" };
    globalThis.fromUuid = async uuid => (uuid === "Actor.attacker" ? attacker : null);
    const target = flaggedActor();
    flaggedActor._self = target;
    await captureWithMimicWire(attacker, target);
    requestRevokeControlOwnership.mockClear();

    await confirmMimicWireExtraction(target);

    expect(isControlled(target)).toBe(false);
    expect(target.updates.at(-1)["system.conditions.mimicWire"]).toBe(false);
    expect(requestRevokeControlOwnership).toHaveBeenCalled();
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-crit-death-btn");
    expect(card).toContain("извлечена");
  });
});
