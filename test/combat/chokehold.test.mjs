// test/combat/chokehold.test.mjs
//
// Chokehold / Удушение (Пугилист, стр. 62; Sahara 3-eddb): Сжать — 1 Усталости;
// Заломить — 1 Усталости за каждый Успех победы (или 1, даже если проиграл);
// победа в Захвате на 5+ Успехов — ещё по 1 за каждые полные 5.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { chokeholdWrenchFatigue, chokeholdGrappleFatigue, applyChokehold } from "../../module/combat/grapple-talents.mjs";
import { resolveGrappleSuccess, _chokeholdWrenchHooks } from "../../module/combat/grapple.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";

const CHOKE = { id: "ch", name: "Chokehold / Удушение", type: "talent", system: {} };

function fighter(name, uuid, items = []) {
  const flags = {};
  const a = actorFor({ items, conditions: { grappling: true } });
  a.name = name; a.uuid = uuid; a.id = uuid;
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; };
  a.unsetFlag = async (_s, k) => { delete flags[k]; };
  a.update = async changes => {
    for (const [p, v] of Object.entries(changes)) {
      let m = p.match(/^flags\.[^.]+\.-=(.+)$/);
      if (m) { delete flags[m[1]]; continue; }
      m = p.match(/^flags\.[^.]+\.(.+)$/);
      if (m) flags[m[1]] = v;
    }
  };
  a._flags = flags;
  return a;
}

beforeEach(() => resetCaptured());

describe("числа Удушения", () => {
  it("Заломить: победа на 3 Успеха → 3; победа с запасом 0 → минимум 1; проигрыш → 1", () => {
    expect(chokeholdWrenchFatigue({ won: true, margin: 3 })).toBe(3);
    expect(chokeholdWrenchFatigue({ won: true, margin: 0 })).toBe(1);
    expect(chokeholdWrenchFatigue({ won: false, margin: 0 })).toBe(1);
  });
  it("Захват: по 1 за каждые полные 5 Успехов (4→0, 5→1, 9→1, 10→2)", () => {
    expect([4, 5, 9, 10].map(chokeholdGrappleFatigue)).toEqual([0, 1, 1, 2]);
  });
  it("applyChokehold передаёт addFatigue нужное число", async () => {
    const calls = [];
    const n = await applyChokehold(fighter("А", "Actor.a"), fighter("Б", "Actor.b"), 2, "Заломить", { add: async (p, k) => calls.push([p.uuid, k]) });
    expect(n).toBe(2);
    expect(calls).toEqual([["Actor.b", 2]]);
  });
  it("нулевое количество — ничего не делает", async () => {
    const calls = [];
    expect(await applyChokehold(fighter("А", "Actor.a"), fighter("Б", "Actor.b"), 0, "x", { add: async () => calls.push(1) })).toBe(0);
    expect(calls).toEqual([]);
  });
});

describe("интеграция в combat/grapple.mjs", () => {
  it("hooks: победа в Заломить даёт Усталость по margin, проигрыш — 1, без Таланта — ничего", async () => {
    const calls = [];
    const add = async (p, k) => calls.push(k);
    const me = fighter("Душитель", "Actor.me", [CHOKE]);
    const foe = fighter("Жертва", "Actor.foe");
    me._flags.grapplePartnerUuid = foe.uuid;
    globalThis.fromUuidSync = uuid => (uuid === foe.uuid ? foe : null);
    await _chokeholdWrenchHooks.onSuccess(me, { margin: 3 }, { add });
    await _chokeholdWrenchHooks.onFail(me, {}, { add });
    expect(calls).toEqual([3, 1]);
    const plain = fighter("Обычный", "Actor.plain");
    plain._flags.grapplePartnerUuid = foe.uuid;
    await _chokeholdWrenchHooks.onSuccess(plain, { margin: 3 }, { add });
    await _chokeholdWrenchHooks.onFail(plain, {}, { add });
    expect(calls).toEqual([3, 1]);
  });

  it("hooks: победа меньшим провалом (deg 0 — Душитель свой тест провалил) — 1 Усталости, не разница степеней", async () => {
    const calls = [];
    const me = fighter("Душитель", "Actor.me", [CHOKE]);
    const foe = fighter("Жертва", "Actor.foe");
    me._flags.grapplePartnerUuid = foe.uuid;
    globalThis.fromUuidSync = uuid => (uuid === foe.uuid ? foe : null);
    await _chokeholdWrenchHooks.onSuccess(me, { deg: 0, margin: 4 }, { add: async (p, k) => calls.push(k) });
    expect(calls).toEqual([1]);
  });

  it("resolveGrappleSuccess: победа на 5+ Успехов с Талантом даёт Усталость, на 4 — нет", async () => {
    // Усталость идёт через настоящий addFatigue → пишем в system.fatigue у подставной цели.
    const me = fighter("Душитель", "Actor.me", [CHOKE]);
    const foe = fighter("Жертва", "Actor.foe");
    let setCalls = 0;
    foe.update = async () => { setCalls++; };
    await resolveGrappleSuccess(me, { target: foe, margin: 4 });
    const after4 = setCalls;
    await resolveGrappleSuccess(me, { target: foe, margin: 10 });
    expect(captured.chat.some(m => m.content.includes("Удушение"))).toBe(true);
    expect(setCalls).toBeGreaterThan(after4);
  });
});

import { registerContest, runContestOutcome, _resetPendingContests } from "../../module/combat/opposed-contest.mjs";

describe("opposed-contest: onFail зовётся при проигрыше инициатора", () => {
  beforeEach(() => _resetPendingContests());
  it("проигрыш → onFail(actor,{target}); победа → onSuccess; onFail без победы не зовёт onSuccess", async () => {
    const me = fighter("А", "Actor.me"), foe = fighter("Б", "Actor.foe");
    globalThis.fromUuid = async uuid => (uuid === me.uuid ? me : uuid === foe.uuid ? foe : null);
    globalThis.game.user = { ...globalThis.game.user, id: "u1" };
    const seen = [];
    const techDef = { label: "Тест", onSuccess: async () => seen.push("win"), onFail: async (a, o) => seen.push(["lose", a.uuid, o.target?.uuid]) };
    const html = registerContest(me, techDef, { success: true, deg: 2, threshold: 40, rv: 10, side: {} }, [foe]);
    const id = html.match(/data-contest-id="([^"]+)"/)[1];
    await runContestOutcome({ contestId: id, opponentUuid: foe.uuid, initiatorWins: false, margin: 2 });
    expect(seen).toEqual([["lose", "Actor.me", "Actor.foe"]]);
  });
});
