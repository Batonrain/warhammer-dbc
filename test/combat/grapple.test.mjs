// test/combat/grapple.test.mjs
//
// Борьба (стр. 12): успешный Приём «Захват» связывает атакующего и цель —
// conditions.grappling на обоих + взаимный флаг партнёра.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyGrappleOnHit, grapplePartner, endGrapple } from "../../module/combat/grapple.mjs";

const FLAG = "warhammer-dbc";

function actorWith(name, uuid) {
  const flags = {};
  const updates = [];
  return {
    id: uuid, name, uuid,
    system: { conditions: { grappling: false } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (changes) => { updates.push(changes); Object.assign(flags, {}); return changes; },
    _flags: flags, _updates: updates
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "roll" };
  globalThis.ChatMessage = {
    applyRollMode: (data) => data,
    create: async () => {},
    getSpeaker: ({ actor }) => ({ actor: actor?.id })
  };
  globalThis.fromUuidSync = () => null;
});

describe("applyGrappleOnHit", () => {
  it("связывает атакующего и цель Борьбой при попадании Приёмом «Захват»", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    const targetToken = { actor: target };

    await applyGrappleOnHit(attacker, targetToken, true, { technique: "grapple" });

    expect(attacker._updates).toContainEqual({ "system.conditions.grappling": true });
    expect(target._updates).toContainEqual({ "system.conditions.grappling": true });
    expect(attacker._flags.grapplePartnerUuid).toBe("Actor.t1");
    expect(target._flags.grapplePartnerUuid).toBe("Actor.a1");
  });

  it("не связывает при промахе", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    await applyGrappleOnHit(attacker, { actor: target }, false, { technique: "grapple" });
    expect(attacker._updates).toHaveLength(0);
    expect(target._updates).toHaveLength(0);
  });

  it("не связывает, если Приём — не «Захват»", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    await applyGrappleOnHit(attacker, { actor: target }, true, { technique: "standard" });
    expect(attacker._updates).toHaveLength(0);
    expect(target._updates).toHaveLength(0);
  });

  it("не связывает актора с самим собой", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    await applyGrappleOnHit(attacker, { actor: attacker }, true, { technique: "grapple" });
    expect(attacker._updates).toHaveLength(0);
  });
});

describe("grapplePartner / endGrapple", () => {
  it("находит партнёра по флагу через fromUuidSync", () => {
    const partner = { id: "p1", name: "Партнёр" };
    globalThis.fromUuidSync = (uuid) => (uuid === "Actor.p1" ? partner : null);
    const actor = actorWith("Актор", "Actor.a1");
    actor.getFlag = (_s, k) => (k === "grapplePartnerUuid" ? "Actor.p1" : undefined);
    expect(grapplePartner(actor)).toBe(partner);
  });

  it("возвращает null без флага партнёра", () => {
    const actor = actorWith("Актор", "Actor.a1");
    expect(grapplePartner(actor)).toBeNull();
  });

  it("endGrapple снимает состояние и флаг с обоих участников", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    globalThis.fromUuidSync = (uuid) => (uuid === "Actor.t1" ? target : null);
    attacker.getFlag = (_s, k) => (k === "grapplePartnerUuid" ? "Actor.t1" : undefined);

    await endGrapple(attacker);

    expect(attacker._updates).toContainEqual({ "system.conditions.grappling": false });
    expect(target._updates).toContainEqual({ "system.conditions.grappling": false });
  });
});
