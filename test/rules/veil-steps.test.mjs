// test/rules/veil-steps.test.mjs
//
// Пачка I4 (Псайкана, Sahara 3-28, решение владельца 27.10.2026): ступени Истончения Завесы,
// которые видит КОНКРЕТНЫЙ персонаж = Завеса сцены + аура «Раны в Реальности» (+1 за каждые три
// бесплатные силы псайкера). Раньше сумму собирал только лист Демона-Принца; теперь это один
// помощник rules/veil-steps.mjs, им же пользуется Призыв демона. Талант и метка — настоящие
// записи пака.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WOUND_FREE_FLAG } from "../../module/rules/wound-in-reality.mjs";
import { sceneVeilSteps, veilStepsFor } from "../../module/rules/veil-steps.mjs";

const DIR = "packs-src/talents/Псайкана";
const woundDoc = () => packDocById(DIR, "HlOOH4XLJ1Oilfjn");
const markerDoc = () => packDocById("packs-src/traits", "WoundRealityAura");

const talent = () => { const d = woundDoc(); return { type: "talent", name: d.name, system: { ...d.system }, flags: {} }; };
const power = (name, free) => ({
  type: "psychicPower", name, id: name,
  system: { isSustained: true, sustainCost: 1 },
  flags: { "warhammer-dbc": free ? { [WOUND_FREE_FLAG]: true } : {} },
  getFlag(s, k) { return this.flags[s]?.[k]; }
});
const psyker = nFree => ({
  type: "character", system: { corruptionBonus: 9, psyker: { rating: 9 } },
  items: [talent(), power("P1"), power("P2"), power("P3"), ...Array.from({ length: nFree }, (_, i) => power(`F${i}`, true))]
});
/** Токен-цель, накрытый аурой источника: настоящая служебная Черта-метка с auraSource. */
const covered = (...sourceUuids) => ({
  type: "character", system: {},
  items: sourceUuids.map(u => {
    const d = markerDoc();
    return { type: "trait", name: d.name, flags: { "warhammer-dbc": { auraSource: u } },
      getFlag(s, k) { return this.flags[s]?.[k]; } };
  })
});
const resolver = map => uuid => (map[uuid] ? { parent: map[uuid] } : null);

const sceneOf = (veil, id = "scene-1") => ({ id, getFlag: (s, k) => (s === "warhammer-dbc" && k === "veil" ? veil : undefined) });

const realGet = globalThis.game.settings.get;
afterEach(() => { globalThis.game.settings.get = realGet; });

describe("Завеса сцены", () => {
  it("читает Истончение сцены (база + ручной сдвиг)", () => {
    expect(sceneVeilSteps(sceneOf({ base: 1, manual: 2 }))).toBe(3);
  });
  it("нет сцены — ноль; сцена без Завесы — ноль", () => {
    expect(sceneVeilSteps(null)).toBe(0);
    expect(sceneVeilSteps(sceneOf(undefined))).toBe(0);
  });
  it("сцена в группе: берётся Завеса группы, а не флаг сцены (как в окне Завесы)", () => {
    globalThis.game.settings.get = (scope, key) =>
      key === "sceneGroups" ? [{ id: "g1", name: "Мир", sceneIds: ["scene-1"], veil: { base: 4 } }] : realGet(scope, key);
    expect(sceneVeilSteps(sceneOf({ base: 1 }))).toBe(4);
  });
});

describe("кто пользуется общим помощником (не своя копия суммы)", () => {
  const src = async p => (await import("node:fs")).readFileSync(new URL(`../../module/${p}`, import.meta.url), "utf8");
  it("лист Демона-Принца и Призыв демона берут ступени у veilStepsFor", async () => {
    for (const p of ["sheets/demon-prince-sheet.mjs", "apps/demon-summon.mjs"]) {
      const text = await src(p);
      expect(text, p).toContain("veilStepsFor(");
      expect(text, p).not.toMatch(/veilTotal\(/);
    }
  });
});

describe("Завеса персонажа: сцена + аура Раны в Реальности", () => {
  it("вне ауры — только Завеса сцены", () => {
    const r = veilStepsFor({ type: "character", system: {}, items: [] }, { scene: sceneOf({ base: 2 }), resolve: resolver({}) });
    expect(r).toEqual({ scene: 2, aura: 0, total: 2 });
  });
  it("в ауре с тремя бесплатными силами — на ступень тоньше (+1)", () => {
    const src = { U1: psyker(3) };
    const r = veilStepsFor(covered("U1"), { scene: sceneOf({ base: 2 }), resolve: resolver(src) });
    expect(r).toEqual({ scene: 2, aura: 1, total: 3 });
  });
  it("одна-две бесплатные силы Завесу не двигают (ступень — за каждые три)", () => {
    expect(veilStepsFor(covered("U1"), { scene: sceneOf({ base: 2 }), resolve: resolver({ U1: psyker(2) }) }).total).toBe(2);
  });
  it("две ауры двух псайкеров складываются по ступеням каждой", () => {
    const r = veilStepsFor(covered("U1", "U2"), { scene: sceneOf({}), resolve: resolver({ U1: psyker(3), U2: psyker(6) }) });
    expect(r).toEqual({ scene: 0, aura: 3, total: 3 });
  });
  it("нет персонажа (ритуал без актора) — только Завеса сцены", () => {
    expect(veilStepsFor(null, { scene: sceneOf({ base: 1 }) })).toEqual({ scene: 1, aura: 0, total: 1 });
  });
  it("сцена не передана — берётся текущая сцена холста", () => {
    const prev = globalThis.canvas;
    globalThis.canvas = { scene: sceneOf({ base: 5 }) };
    try {
      expect(veilStepsFor({ type: "character", system: {}, items: [] }).total).toBe(5);
    } finally { globalThis.canvas = prev; }
  });
});
