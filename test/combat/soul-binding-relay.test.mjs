// Связывание Души: запись в чужого партнёра — через ГМа (приёмка #597).
import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkTargetWrite } from "../../module/combat/gm-relay.mjs";
import { shareSoulBondDamage } from "../../module/combat/soul-binding.mjs";

const NS = "warhammer-dbc";
const actorOf = (uuid, partners = [], extra = {}) => ({
  uuid, name: uuid, flags: { [NS]: { soulBondPartners: partners, ...extra } },
  getFlag(ns, k) { return this.flags[ns]?.[k]; }
});

describe("checkTargetWrite: Связывание Души", () => {
  const rit = actorOf("Actor.R", ["Actor.M"]);
  const minion = actorOf("Actor.M", ["Actor.R"]);
  const stranger = actorOf("Actor.X");
  const ctx = (initiator, target) => ({ initiatorOwned: true, initiator, target });
  it("только между связанными", () => {
    expect(checkTargetWrite({ kind: "soulBondShare", amount: 5 }, ctx(rit, minion)).ok).toBe(true);
    expect(checkTargetWrite({ kind: "soulBondShare", amount: 5 }, ctx(rit, stranger)).ok).toBe(false);
    expect(checkTargetWrite({ kind: "soulBondLink" }, ctx(rit, minion)).ok).toBe(true);
    expect(checkTargetWrite({ kind: "soulBondLink" }, ctx(stranger, minion)).ok).toBe(false);
  });
  it("число в пределах, лишних полей нет; потеря W — только от мёртвой цели", () => {
    expect(checkTargetWrite({ kind: "soulBondShare", amount: 0 }, ctx(rit, minion)).ok).toBe(false);
    expect(checkTargetWrite({ kind: "soulBondShare", amount: 3, x: 1 }, ctx(rit, minion)).ok).toBe(false);
    expect(checkTargetWrite({ kind: "soulBondDeathLoss", amount: 12 }, ctx(minion, rit)).ok).toBe(false);
    const dead = actorOf("Actor.M", ["Actor.R"], { deceased: true });
    expect(checkTargetWrite({ kind: "soulBondDeathLoss", amount: 12 }, ctx(dead, rit)).ok).toBe(true);
    expect(checkTargetWrite({ kind: "soulBondDeathLoss", amount: 30 }, ctx(dead, rit)).ok).toBe(false);
  });
});

describe("shareSoulBondDamage: чужой партнёр", () => {
  let prev;
  const emitted = [];
  beforeEach(() => {
    emitted.length = 0;
    prev = { socket: globalThis.game.socket, users: globalThis.game.users, user: globalThis.game.user };
    globalThis.game.socket = { emit: (_c, payload) => emitted.push(payload) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    globalThis.game.user = { id: "u1", isGM: false };
  });
  afterEach(() => { Object.assign(globalThis.game, prev); });
  it("доля уходит ГМу по сокету, а не теряется", async () => {
    const partner = { ...actorOf("Actor.M", ["Actor.R"]), isOwner: false, system: { wounds: { value: 10, max: 10 } } };
    const self = actorOf("Actor.R", ["Actor.M"]);
    const saved = globalThis.fromUuid;
    globalThis.fromUuid = async u => (u === "Actor.M" ? partner : null);
    try {
      const r = await shareSoulBondDamage(self, 10);
      expect(r.net).toBe(5);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({ targetUuid: "Actor.M", initiatorUuid: "Actor.R", op: { kind: "soulBondShare", amount: 5 } });
      expect(r.note).not.toContain("впишет ГМ");
    } finally { globalThis.fromUuid = saved; }
  });
});
