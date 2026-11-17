import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";

const infection = vi.hoisted(() => ({ calls: [] }));
vi.mock("../../module/combat/disease-infection.mjs", () => ({
  rollInfectionTest: async (actor, item, opts) => { infection.calls.push({ actor, item, opts }); return "infected"; }
}));

import { WastelandZoneBehaviorType, WASTELAND_ZONE_TYPE } from "../../module/regions/wasteland-zone.mjs";

const enter = WastelandZoneBehaviorType.events[CONST.REGION_EVENTS.TOKEN_ENTER];

function zone(overrides = {}) {
  const updates = [];
  return {
    updates,
    carrierUuid: "Actor.pm", diseaseId: "", expiresAt: 99999, tested: {},
    behavior: { update: async d => { updates.push(d); } },
    region: { name: "Заражённая местность" },
    ...overrides
  };
}

const walker = (id, over = {}) => ({
  id, actor: { uuid: `Actor.${id}`, name: id, type: "character", system: {}, getFlag: () => undefined, items: [],
    createEmbeddedDocuments: async (_t, docs) => docs.map(d => ({ ...d, delete: async () => {} })), ...over }
});

beforeEach(() => {
  resetCaptured();
  infection.calls = [];
  globalThis.game.user = { isGM: true };
  globalThis.game.time = { worldTime: 100 };
  const disease = { id: "d1", name: "Гниль", type: "disease", system: { active: true }, toObject: () => ({ name: "Гниль", type: "disease", system: { active: true } }) };
  const pm = { uuid: "Actor.pm", name: "Чумной", items: [disease], getFlag: () => undefined, system: {} };
  globalThis.fromUuid = async uuid => (uuid === "Actor.pm" ? pm : null);
});

describe("Область «Заражённая местность»", () => {
  it("зарегистрирована под своим типом", () => {
    expect(WASTELAND_ZONE_TYPE).toBe("wastelandZone");
    expect(typeof enter).toBe("function");
  });

  it("не-ГМ ничего не пишет", async () => {
    globalThis.game.user.isGM = false;
    const z = zone();
    await enter.call(z, { data: { token: walker("t1") } });
    expect(z.updates).toHaveLength(0);
    expect(infection.calls).toHaveLength(0);
  });

  it("входящий токен отмечается и проверяется на заражение один раз", async () => {
    const z = zone();
    await enter.call(z, { data: { token: walker("t1") } });
    expect(z.updates).toEqual([{ "system.tested.t1": true }]);
    expect(infection.calls).toHaveLength(1);
    expect(infection.calls[0].opts.vector).toEqual({ label: "Заражённая местность", char: "t", mod: 0 });

    const again = zone({ tested: { t1: true } });
    await enter.call(again, { data: { token: walker("t1") } });
    expect(again.updates).toHaveLength(0);
    expect(infection.calls).toHaveLength(1);
  });

  it("токен без актора пропускается", async () => {
    const z = zone();
    await enter.call(z, { data: { token: { id: "t9", actor: null } } });
    expect(z.updates).toHaveLength(0);
  });
});
