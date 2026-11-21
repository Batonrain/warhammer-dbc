// test/rules/thirst-warp.test.mjs
//
// Жажда Вампира (Черта «The Thirst / Жажда», Sahara 583-5-t-10): «Урон от
// варп-оружия наносится в его Жажду, считая каждый пункт как 5 Ран (расход
// Жажды округляется вверх); при этом его тошнит кровью и он проходит тест
// T+10 или Оглушается на 1 Раунд». Ядро — rules/resource-pools.mjs
// (warpPoolAbsorb, warpSoakPoolDef), Foundry-сторона — combat/thirst-warp.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi } from "vitest";
import { warpPoolAbsorb, warpSoakPoolDef, resourcePoolDefs } from "../../module/rules/resource-pools.mjs";

const pool = (key, max) => ({
  name: key, type: "trait",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ kind: "resourcePool", resPoolKey: key, resPoolMax: String(max) }] }] } }
});
const actorWith = (items, pools = {}) => {
  const doc = { id: "v1", uuid: "Actor.v1", name: "Вампир", type: "character", items,
    system: { resourcePools: { ...pools }, characteristics: { t: { total: 40, bonus: 4 } }, conditions: {} },
    flags: {} };
  doc.update = vi.fn(async ch => {
    for (const [p, v] of Object.entries(ch)) {
      const ks = p.split("."); let n = doc;
      for (const k of ks.slice(0, -1)) n = (n[k] ??= {});
      n[ks.at(-1)] = v;
    }
  });
  return doc;
};

describe("warpPoolAbsorb — пункт Жажды за 5 Ран, расход вверх", () => {
  it("хватает: 12 урона — 3 Жажды (окр.▲), всё поглощено", () => {
    expect(warpPoolAbsorb(5, 12, 5)).toEqual({ spent: 3, absorbed: 12, remaining: 0 });
  });
  it("ровно: 10 урона — 2 Жажды", () => {
    expect(warpPoolAbsorb(5, 10, 5)).toEqual({ spent: 2, absorbed: 10, remaining: 0 });
  });
  it("не хватает: 2 Жажды гасят 10, остаток 2 — в Раны", () => {
    expect(warpPoolAbsorb(2, 12, 5)).toEqual({ spent: 2, absorbed: 10, remaining: 2 });
  });
  it("пустой пул или нет урона — ничего", () => {
    expect(warpPoolAbsorb(0, 12, 5)).toEqual({ spent: 0, absorbed: 0, remaining: 12 });
    expect(warpPoolAbsorb(4, 0, 5)).toEqual({ spent: 0, absorbed: 0, remaining: 0 });
  });
});

describe("warpSoakPoolDef — у какого пула урон варп-оружия", () => {
  it("Жажда — 5 Ран за пункт; Месть и Вдохновение — нет", () => {
    const a = actorWith([pool("thirst", 6), pool("vengeance", 3)], { thirst: 4, vengeance: 3 });
    expect(resourcePoolDefs(a).get("thirst").warpWoundsPerPoint).toBe(5);
    expect(resourcePoolDefs(a).get("vengeance").warpWoundsPerPoint).toBe(0);
    expect(warpSoakPoolDef(a)?.key).toBe("thirst");
  });
  it("без пула Жажды — null", () => {
    expect(warpSoakPoolDef(actorWith([pool("vengeance", 3)]))).toBeNull();
  });
});

describe("thirstWarpIntercept (combat/thirst-warp.mjs)", () => {
  it("списывает Жажду, гасит урон и бросает T+10; провал — Оглушение на 1 Раунд", async () => {
    vi.resetModules();
    const roll = vi.fn(async () => ({ success: false, deg: 1 }));
    vi.doMock("../../module/combat/resilience-test.mjs", () => ({ rollResilienceTest: roll }));
    const apply = vi.fn(async () => ({ fields: { "system.conditions.stunned": 1 }, note: "" }));
    vi.doMock("../../module/combat/status-resist.mjs", () => ({ statusApplyFields: apply }));
    const { thirstWarpIntercept } = await import("../../module/combat/thirst-warp.mjs");
    const a = actorWith([pool("thirst", 9)], { thirst: 4 });
    const r = await thirstWarpIntercept(a, 12);
    expect(r.net).toBe(0);
    expect(a.system.resourcePools.thirst).toBe(1);
    expect(roll).toHaveBeenCalledWith(a, "t", expect.objectContaining({ mod: 10 }));
    expect(apply).toHaveBeenCalledWith(a, "stunned", 1, expect.anything());
    expect(a.system.conditions.stunned).toBe(1);
    expect(r.note).toMatch(/3 Жажды/);
    vi.doUnmock("../../module/combat/resilience-test.mjs");
    vi.doUnmock("../../module/combat/status-resist.mjs");
  });
  it("успех T+10 — без Оглушения; нет Жажды — урон идёт как есть, без теста", async () => {
    vi.resetModules();
    const roll = vi.fn(async () => ({ success: true, deg: 2 }));
    vi.doMock("../../module/combat/resilience-test.mjs", () => ({ rollResilienceTest: roll }));
    const apply = vi.fn();
    vi.doMock("../../module/combat/status-resist.mjs", () => ({ statusApplyFields: apply }));
    const { thirstWarpIntercept } = await import("../../module/combat/thirst-warp.mjs");
    const a = actorWith([pool("thirst", 9)], { thirst: 1 });
    const r = await thirstWarpIntercept(a, 8);
    expect(r.net).toBe(3);
    expect(a.system.resourcePools.thirst).toBe(0);
    expect(apply).not.toHaveBeenCalled();
    const empty = actorWith([pool("thirst", 9)], { thirst: 0 });
    roll.mockClear();
    expect((await thirstWarpIntercept(empty, 8)).net).toBe(8);
    expect(roll).not.toHaveBeenCalled();
    expect((await thirstWarpIntercept(actorWith([]), 8)).net).toBe(8);
    vi.doUnmock("../../module/combat/resilience-test.mjs");
    vi.doUnmock("../../module/combat/status-resist.mjs");
  });
});
