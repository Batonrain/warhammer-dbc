// test/combat/gm-relay-damage.test.mjs
//
// ГМ получает от игрока запрос «нанести урон приёма» (Sahara npc-applydamagetoactor): сверка владения и Борьбы,
// сам урон считает applyDamageToActor на клиенте ГМа. Конвейер урона здесь подменён — проверяется только то,
// что релей его вызывает с теми полями и в тех случаях, где положено.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const applied = [];
vi.mock("../../module/combat/damage.mjs", () => ({
  applyDamageToActor: async (actor, data) => { applied.push([actor.uuid, data]); }
}));

const { applyTargetWriteRelay } = await import("../../module/combat/gm-relay.mjs");

const NS = "warhammer-dbc";
const REQUESTER = { id: "u-req", isGM: false };
const dmg = (over = {}) => ({
  rawDamage: 9, penetration: 0, damageType: "impact", hitLocation: "Торс", melee: true,
  attackerName: "Игрок", attackerUuid: "Actor.me", weaponName: "Заломить", ...over
});
const actor = (uuid, flags = {}, extra = {}) => ({
  uuid, name: uuid, items: [], type: "character", update: async () => {}, getFlag: (_s, k) => flags[k], ...extra
});

const prevFrom = globalThis.fromUuid;
beforeEach(() => { applied.length = 0; });
afterEach(() => { globalThis.fromUuid = prevFrom; });

function world(me, foe) {
  globalThis.fromUuid = async uuid => (uuid === me.uuid ? me : uuid === foe.uuid ? foe : null);
}
const relay = (op, requester = REQUESTER) =>
  applyTargetWriteRelay({ initiatorUuid: "Actor.me", targetUuid: "Actor.foe", op }, requester);

describe("релей урона приёма (ГМ)", () => {
  const mine = flags => actor("Actor.me", flags, { testUserPermission: (u, l) => u === REQUESTER && l === "OWNER" });

  it("партнёр по Борьбе (флаг у инициатора): ГМ применяет урон к цели с теми же полями", async () => {
    world(mine({ grapplePartnerUuid: "Actor.foe" }), actor("Actor.foe"));
    expect(await relay({ kind: "applyDamage", source: "grapple", damage: dmg() })).toBe(true);
    expect(applied).toEqual([["Actor.foe", dmg()]]);
  });

  it("партнёр по Борьбе (флаг только у цели) — тоже", async () => {
    world(mine({}), actor("Actor.foe", { grapplePartnerUuid: "Actor.me" }));
    expect(await relay({ kind: "applyDamage", source: "grapple", damage: dmg() })).toBe(true);
    expect(applied).toHaveLength(1);
  });

  it("не партнёр по Борьбе — «grapple» отклоняется, урон не применяется", async () => {
    world(mine({}), actor("Actor.foe"));
    expect(await relay({ kind: "applyDamage", source: "grapple", damage: dmg() })).toBe(false);
    expect(applied).toEqual([]);
  });

  it("«contact» (Повалить на 5+) не требует Борьбы, но сверяет владение и поля", async () => {
    world(mine({}), actor("Actor.foe"));
    expect(await relay({ kind: "applyDamage", source: "contact", damage: dmg({ primitive: true, weaponName: "Повалить" }) })).toBe(true);
    expect(applied).toHaveLength(1);
    applied.length = 0;
    expect(await relay({ kind: "applyDamage", source: "contact", damage: dmg({ rawDamage: 5000 }) })).toBe(false);
    expect(await relay({ kind: "applyDamage", source: "contact", damage: dmg() }, { id: "u-other", isGM: false })).toBe(false);
    expect(applied).toEqual([]);
  });

  it("атакующий в данных урона — не инициатор: отказ", async () => {
    world(mine({ grapplePartnerUuid: "Actor.foe" }), actor("Actor.foe"));
    expect(await relay({ kind: "applyDamage", source: "grapple", damage: dmg({ attackerUuid: "Actor.someoneElse" }) })).toBe(false);
    expect(applied).toEqual([]);
  });
});

describe("стыковка", () => {
  it("флаг партнёра, по которому релей определяет Борьбу, — тот же, что пишет Захват", async () => {
    const { PARTNER_FLAG } = await import("../../module/combat/grapple.mjs");
    expect(PARTNER_FLAG).toBe("grapplePartnerUuid");
    expect(NS).toBe("warhammer-dbc");
  });
});
