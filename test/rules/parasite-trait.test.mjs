// test/rules/parasite-trait.test.mjs
import { describe, it, expect, afterEach } from "vitest";
import {
  parasiticContactSourceUuid, possessingParasiteUuid, isPossessedByParasite, applyParasiteFusion,
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
    applyParasiteFusion({}, system, chars);
    expect(system.initiative).toBe(5);
    expect(chars.per.total).toBe(30);
  });

  it("нет флага possessedByParasiteUuid — не трогает", () => {
    globalThis.game = {};
    globalThis.fromUuidSync = () => null;
    const system = { initiative: 5 };
    const chars = { per: { total: 30 } };
    applyParasiteFusion(flaggedActor({}), system, chars);
    expect(system.initiative).toBe(5);
  });

  it("паразит не резолвится — не трогает, не падает", () => {
    globalThis.game = {};
    globalThis.fromUuidSync = () => { throw new Error("не найден"); };
    const system = { initiative: 5 };
    const chars = { per: { total: 30 } };
    applyParasiteFusion(flaggedActor({ [POSSESSED_BY_PARASITE_FLAG]: "Actor.gone" }), system, chars);
    expect(system.initiative).toBe(5);
  });

  it("успех — Инициатива/P/W перезаписаны, WS/BS — лучший из двух", () => {
    globalThis.game = {};
    const parasite = {
      system: {
        initiative: 12,
        characteristics: {
          per: { total: 45 }, wp: { total: 50 }, ws: { total: 30 }, bs: { total: 60 }
        }
      }
    };
    globalThis.fromUuidSync = uuid => (uuid === "Actor.parasite" ? parasite : null);

    const system = { initiative: 5 };
    const chars = {
      per: { total: 20 }, wp: { total: 20 }, ws: { total: 40 }, bs: { total: 25 }
    };
    applyParasiteFusion(flaggedActor({ [POSSESSED_BY_PARASITE_FLAG]: "Actor.parasite" }), system, chars);

    expect(system.initiative).toBe(12);
    expect(chars.per.total).toBe(45);
    expect(chars.wp.total).toBe(50);
    expect(chars.ws.total).toBe(40); // хоста выше (40 > 30) — остаётся своя
    expect(chars.bs.total).toBe(60); // паразита выше (60 > 25) — берётся его
  });
});
