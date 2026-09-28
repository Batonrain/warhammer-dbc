// test/combat/inspiring-presence.test.mjs
//
// Вдохновляющее Присутствие (Чемпион, корбук стр. 15): союзник в поле зрения
// Чемпиона тратит его Очко Бесчестья на переброс.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { canInspire, inspireBlockReason, INSPIRING_PRESENCE } from "../../module/rules/inspiring-presence.mjs";
import { inspiringChampionsFor, spendInspiringInfamy } from "../../module/combat/inspiring-presence.mjs";

const capTrait = key => ({
  id: `trait-${key}`, name: key, type: "trait", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } },
  getFlag: () => undefined
});

function actor(id, { champion = false, fate = 0, owner = true } = {}) {
  const a = {
    id, uuid: `Actor.${id}`, name: id, type: "character", isOwner: owner,
    system: { fate: { value: fate } },
    items: champion ? [capTrait(INSPIRING_PRESENCE)] : [],
    getFlag: () => undefined,
    async update(data) { for (const [k, v] of Object.entries(data)) if (k === "system.fate.value") a.system.fate.value = v; }
  };
  return a;
}

const token = (a, x, { disposition = 1, rotation = 0, angle = 360 } = {}) => ({
  actor: a,
  document: { id: `tok-${a.id}`, x, y: 0, width: 1, height: 1, elevation: 0, disposition, rotation, sight: { range: 0, angle } }
});

let savedCanvas, savedGame, savedGetProperty;
beforeEach(() => {
  resetCaptured();
  savedCanvas = globalThis.canvas;
  savedGame = globalThis.game;
  // Заглушка getProperty всегда отдаёт undefined — списанию пула нужен
  // настоящий путь «system.fate.value».
  savedGetProperty = foundry.utils.getProperty;
  foundry.utils.getProperty = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
});
afterEach(() => {
  globalThis.canvas = savedCanvas;
  globalThis.game = savedGame;
  foundry.utils.getProperty = savedGetProperty;
});

function scene(tokens) {
  globalThis.canvas = { tokens: { placeables: tokens }, scene: { grid: { size: 100, distance: 1 } } };
}

describe("canInspire / inspireBlockReason", () => {
  it("союзник в поле зрения — да; сам Чемпион, враг, вне зрения — нет", () => {
    expect(canInspire({ sameActor: false, relation: "ally", inSight: true })).toBe(true);
    expect(canInspire({ sameActor: true, relation: "ally", inSight: true })).toBe(false);
    expect(canInspire({ sameActor: false, relation: "enemy", inSight: true })).toBe(false);
    expect(canInspire({ sameActor: false, relation: "ally", inSight: false })).toBe(false);
  });
  it("причина недоступности: нет Очков / некому списать", () => {
    expect(inspireBlockReason({ pool: 0, canSpend: true })).toMatch(/нет Очков/);
    expect(inspireBlockReason({ pool: 2, canSpend: false })).toMatch(/нет ГМа/);
    expect(inspireBlockReason({ pool: 2, canSpend: true })).toBe("");
  });
});

describe("inspiringChampionsFor — сцена", () => {
  it("союзный Чемпион рядом — предлагается, с числом Очков", () => {
    const champ = actor("champ", { champion: true, fate: 2 });
    const ally = actor("ally");
    scene([token(champ, 0), token(ally, 300)]);
    const list = inspiringChampionsFor(ally);
    expect(list.map(c => c.actor.id)).toEqual(["champ"]);
    expect(list[0].pool).toBe(2);
    expect(list[0].reason).toBe("");
  });

  it("враждебный токен Чемпиона — нет", () => {
    const champ = actor("champ", { champion: true, fate: 2 });
    const ally = actor("ally");
    scene([token(champ, 0, { disposition: -1 }), token(ally, 300)]);
    expect(inspiringChampionsFor(ally)).toEqual([]);
  });

  it("далеко за пределом обзора (30 м по умолчанию) — нет", () => {
    const champ = actor("champ", { champion: true, fate: 2 });
    const ally = actor("ally");
    scene([token(champ, 0), token(ally, 100 * 50)]);
    expect(inspiringChampionsFor(ally)).toEqual([]);
  });

  it("персонаж без Черты — не Чемпион", () => {
    const other = actor("other", { fate: 2 });
    const ally = actor("ally");
    scene([token(other, 0), token(ally, 300)]);
    expect(inspiringChampionsFor(ally)).toEqual([]);
  });

  it("сам Чемпион своим тестом — не через эту строку", () => {
    const champ = actor("champ", { champion: true, fate: 2 });
    scene([token(champ, 0)]);
    expect(inspiringChampionsFor(champ)).toEqual([]);
  });
});

describe("spendInspiringInfamy", () => {
  it("владелец Чемпиона — Очко списывается сразу", async () => {
    const champ = actor("champ", { champion: true, fate: 2 });
    const res = await spendInspiringInfamy(champ, actor("ally"));
    expect(res).toEqual({ poolValue: 1, relayed: false });
    expect(champ.system.fate.value).toBe(1);
  });

  it("чужой Чемпион — просьба к ГМу по сокету", async () => {
    const sent = [];
    globalThis.game = { ...savedGame, users: { activeGM: { id: "gm" } }, user: { id: "u1" },
      socket: { emit: (_ch, data) => sent.push(data) } };
    const champ = actor("champ", { champion: true, fate: 2, owner: false });
    const res = await spendInspiringInfamy(champ, actor("ally"));
    expect(res.relayed).toBe(true);
    expect(sent[0]).toMatchObject({ action: "inspiringPresenceSpend", championUuid: "Actor.champ", borrowerUuid: "Actor.ally" });
  });

  it("чужой Чемпион и нет ГМа — не списать", async () => {
    globalThis.game = { ...savedGame, users: { activeGM: null } };
    const champ = actor("champ", { champion: true, fate: 2, owner: false });
    expect(await spendInspiringInfamy(champ, actor("ally"))).toBeNull();
  });
});
