// Архимагос, Foundry-сторона: Конкордакс по списку «Под моим Присутствием»,
// Аватар Металла (I вместо WS/BS), Лик Гнева (Страх 3) — 21.11.2026.
import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { concordaxBonusFor, avatarChanges, visioIraeEffectData } from "../../module/combat/archmagos.mjs";
import { getRuleSources } from "../../module/rules/source-registry.mjs";

const servant = (uuid, items) => ({ uuid, items, getFlag: (_ns, k) => (k === "commandedBy" ? { uuid: "Actor.arch" } : undefined) });
const docs = {};

beforeEach(() => {
  globalThis.fromUuidSync = uuid => docs[uuid] ?? null;
  docs["Actor.arch"] = {
    uuid: "Actor.arch", name: "Архимагос",
    items: [{ type: "talent", name: "Concordax / Конкордакс" }],
    system: { command: { presence: { active: true } }, followers: [{ uuid: "Actor.s1" }, { uuid: "Actor.s2" }, { uuid: "Actor.h" }] },
    getFlag: () => undefined
  };
  docs["Actor.s1"] = servant("Actor.s1", [{ type: "trait", name: "Machine (4) / Машина (4)" }]);
  docs["Actor.s2"] = servant("Actor.s2", [{ type: "implant", name: "x", system: { category: "mechanicus" } }]);
  docs["Actor.h"] = servant("Actor.h", []);
});

describe("Конкордакс", () => {
  it("Архимагос и машинные слуги получают число слуг + 1, человек — нет", () => {
    expect(concordaxBonusFor(docs["Actor.arch"]).value).toBe(3);
    expect(concordaxBonusFor(docs["Actor.s1"]).value).toBe(3);
    expect(concordaxBonusFor(docs["Actor.h"]).value).toBe(0);
  });
  it("без Присутствия — ничего", () => {
    docs["Actor.arch"].system.command.presence.active = false;
    expect(concordaxBonusFor(docs["Actor.arch"]).value).toBe(0);
    expect(concordaxBonusFor(docs["Actor.s1"]).value).toBe(0);
  });
  it("источник правил не трогает тесты T", () => {
    globalThis.game ??= {};
    const src = getRuleSources().find(([k]) => k === "archmagosConcordax")?.[1];
    expect(src).toBeTruthy();
    expect(src(docs["Actor.arch"], { kind: "char", char: "t" })).toEqual([]);
    expect(src(docs["Actor.arch"], { kind: "char", char: "ws" })[0].effects[0].value).toBe(3);
  });
});

describe("Аватар Металла и Лик Гнева", () => {
  it("WS и BS слуги доводятся до I Архимагоса", () => {
    const ch = avatarChanges({ system: { characteristics: { ws: { total: 30 }, bs: { total: 45 } } } }, 60);
    expect(ch.map(c => c.value)).toEqual([30, 15]);
  });
  it("Страх 3 — upgrade", () => {
    const c = visioIraeEffectData("i1").system.changes[0];
    expect(c).toMatchObject({ key: "system.fearRating", type: "upgrade", value: 3 });
  });
});
