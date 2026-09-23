// test/rules/parasite-trait.test.mjs
import { describe, it, expect, afterEach } from "vitest";
import {
  parasiticContactSourceUuid, possessingParasiteUuid, isPossessedByParasite, applyParasiteFusion, fuseParasiteCharacteristic, refreshParasiteHosts,
  PARASITIC_CONTACT_SOURCE_FLAG, POSSESSED_BY_PARASITE_FLAG
} from "../../module/rules/parasite-trait.mjs";

function flaggedActor(flags = {}) {
  return { flags: { "warhammer-dbc": flags }, getFlag: (scope, key) => flags[key] };
}

describe("parasiticContactSourceUuid / possessingParasiteUuid / isPossessedByParasite", () => {
  it("читает соответствующие флаги", () => {
    const contactActor = flaggedActor({ [PARASITIC_CONTACT_SOURCE_FLAG]: "Actor.p1" });
    expect(parasiticContactSourceUuid(contactActor)).toBe("Actor.p1");
    expect(possessingParasiteUuid(contactActor)).toBe(null);

    const possessedActor = flaggedActor({ [POSSESSED_BY_PARASITE_FLAG]: "Actor.p2" });
    expect(possessingParasiteUuid(possessedActor)).toBe("Actor.p2");
    expect(isPossessedByParasite(possessedActor)).toBe(true);
  });
  it("нет флагов — null/false, не падает", () => {
    expect(parasiticContactSourceUuid(null)).toBe(null);
    expect(possessingParasiteUuid({})).toBe(null);
    expect(isPossessedByParasite({})).toBe(false);
  });
});

describe("applyParasiteFusion", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.fromUuidSync; });

  it("нет game/fromUuidSync — не трогает system/chars", () => {
    delete globalThis.game;
    const system = { initiative: 5 };
    const chars = { per: { total: 30 }, wp: { total: 30 } };
    applyParasiteFusion({}, system);
    expect(system.initiative).toBe(5);
    expect(chars.per.total).toBe(30);
  });

  it("нет флага possessedByParasiteUuid — не трогает", () => {
    globalThis.game = {};
    globalThis.fromUuidSync = () => null;
    const system = { initiative: 5 };
    applyParasiteFusion(flaggedActor({}), system);
    expect(system.initiative).toBe(5);
  });

  it("паразит не резолвится — не трогает, не падает", () => {
    globalThis.game = {};
    globalThis.fromUuidSync = () => { throw new Error("не найден"); };
    const system = { initiative: 5 };
    applyParasiteFusion(flaggedActor({ [POSSESSED_BY_PARASITE_FLAG]: "Actor.gone" }), system);
    expect(system.initiative).toBe(5);
  });

  it("успех — хвост перезаписывает Инициативу", () => {
    globalThis.game = {};
    const parasite = { system: { initiative: 12 } };
    globalThis.fromUuidSync = uuid => (uuid === "Actor.parasite" ? parasite : null);
    const system = { initiative: 5 };
    applyParasiteFusion(flaggedActor({ [POSSESSED_BY_PARASITE_FLAG]: "Actor.parasite" }), system);
    expect(system.initiative).toBe(12);
  });
});

// Сквозная проверка через prepareDerivedData (Бонусы, Навыки, Здравомыслие) —
// test/documents/parasite-fusion-derived.test.mjs.
describe("fuseParasiteCharacteristic", () => {
  it("Int/Per/WP — всегда паразита, число и Бонус вместе", () => {
    for (const key of ["int", "per", "wp"]) {
      const char = { total: 60, bonus: 6 };
      expect(fuseParasiteCharacteristic(key, char, { total: 30, bonus: 5 })).toBe(true);
      expect(char).toEqual({ total: 30, bonus: 5 });
    }
  });
  it("WS/BS — только если у паразита выше", () => {
    const ws = { total: 40, bonus: 4 };
    expect(fuseParasiteCharacteristic("ws", ws, { total: 30, bonus: 3 })).toBe(false);
    expect(ws.total).toBe(40);
    const bs = { total: 25, bonus: 2 };
    expect(fuseParasiteCharacteristic("bs", bs, { total: 60, bonus: 6 })).toBe(true);
    expect(bs).toEqual({ total: 60, bonus: 6 });
  });
  it("S/T/Ag/Fel/Inf — тело хоста, не трогаются", () => {
    for (const key of ["s", "t", "ag", "fel", "inf"]) {
      const char = { total: 20, bonus: 2 };
      expect(fuseParasiteCharacteristic(key, char, { total: 90, bonus: 9 })).toBe(false);
      expect(char.total).toBe(20);
    }
  });
});

// wdbc-bjy1.14: хост берёт числа паразита в prepareDerivedData, а обновление
// ТОЛЬКО паразита пересчёт хоста не запускает — хост держал старые числа до
// своего следующего обновления. refreshParasiteHosts пересчитывает хостов.
describe("refreshParasiteHosts — хост пересчитывается вслед за паразитом", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.canvas; });
  const host = (uuid, parasiteUuid) => {
    const a = flaggedActor(parasiteUuid ? { [POSSESSED_BY_PARASITE_FLAG]: parasiteUuid } : {});
    a.uuid = uuid; a.resets = 0; a.renders = 0;
    a.reset = () => { a.resets++; };
    a.sheet = { rendered: true, render: () => { a.renders++; } };
    return a;
  };

  it("пересчитывает хостов ЭТОГО паразита (мировых и на токенах сцены), других не трогает", () => {
    const mine = host("Actor.h1", "Actor.p"), other = host("Actor.h2", "Actor.q"), free = host("Actor.h3");
    const tokenHost = host("Scene.s.Token.t.Actor.h4", "Actor.p");
    globalThis.game = { actors: [mine, other, free] };
    globalThis.canvas = { tokens: { placeables: [{ actor: tokenHost }, { actor: mine }] } };
    const n = refreshParasiteHosts({ uuid: "Actor.p" });
    expect(n).toBe(2);
    expect([mine.resets, tokenHost.resets, other.resets, free.resets]).toEqual([1, 1, 0, 0]);
    expect(mine.renders).toBe(1);
  });

  it("не паразит (никто на него не ссылается) — ничего", () => {
    globalThis.game = { actors: [host("Actor.h1", "Actor.p")] };
    expect(refreshParasiteHosts({ uuid: "Actor.zzz" })).toBe(0);
  });
});
