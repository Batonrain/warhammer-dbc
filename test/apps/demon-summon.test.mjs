// test/apps/demon-summon.test.mjs
//
// module/apps/demon-summon.mjs — токен призванного демона на успехе ритуала
// (module/apps/ritual-cast.mjs, type:"summon"). Бестиарий скрыт от игрока
// (system.json, ownership.PLAYER:"NONE"), поэтому поиск по имени и создание
// Актора/Токена — привилегированное действие: ГМ напрямую, иначе сокет-релей
// (тот же приём, что у veilShift/startCharacter, warhammer-dbc.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import { spawnDemonOnScene, defaultSpawnDemonFn } from "../../module/apps/demon-summon.mjs";

function bestiaryPack(entries) {
  return {
    getIndex: async () => entries,
    getDocument: async id => {
      const e = entries.find(x => x._id === id);
      return e ? { ...e, toObject: () => ({ ...e }) } : null;
    }
  };
}

function stubScene({ createdTokens = [] } = {}) {
  return {
    dimensions: { width: 2000, height: 2000 },
    grid: { size: 100 },
    createEmbeddedDocuments: async (type, docs) => { createdTokens.push(...docs); return docs; }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = {};
  globalThis.game.users = { activeGM: null };
  globalThis.game.packs = new Map();
  globalThis.canvas = { scene: null, tokens: { placeables: [] } };
  globalThis.game.scenes = { current: null };
  globalThis.Actor.create = async data => ({ ...data, name: data.name, getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ name: data.name, x, y }) }) });
  globalThis.fromUuid = async () => null;
});

describe("поиск и создание демона на сцене (spawnDemonOnScene)", () => {
  it("демон найден в Бестиарии по русской части имени — Актор и токен создаются", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Bloodthirster / Кровожад" }]));
    const created = [];
    globalThis.canvas.scene = stubScene({ createdTokens: created });

    const res = await spawnDemonOnScene("Кровожад");

    expect(res).toEqual({ ok: true, actorName: "Bloodthirster / Кровожад" });
    expect(created.length).toBe(1);
  });

  it("совпадение без учёта регистра", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Bloodthirster / Кровожад" }]));
    globalThis.canvas.scene = stubScene();

    const res = await spawnDemonOnScene("кровожад");
    expect(res.ok).toBe(true);
  });

  it("демон не найден — ok:false с причиной, ничего не создаётся", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Bloodthirster / Кровожад" }]));
    const created = [];
    globalThis.canvas.scene = stubScene({ createdTokens: created });

    const res = await spawnDemonOnScene("Нет такого демона");

    expect(res.ok).toBe(false);
    expect(res.reason).toContain("не найден");
    expect(created.length).toBe(0);
  });

  it("нет активной сцены — ok:false, Актор не создаётся", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Bloodthirster / Кровожад" }]));
    globalThis.canvas.scene = null;
    globalThis.game.scenes.current = null;

    const res = await spawnDemonOnScene("Кровожад");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("сцен");
  });

  it("токен ставится рядом с токеном ритуалиста, если тот выбран на холсте", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровожад" }]));
    const created = [];
    globalThis.canvas.scene = stubScene({ createdTokens: created });
    globalThis.canvas.tokens.placeables = [
      { actor: { uuid: "Actor.rit-1" }, document: { x: 500, y: 600 } }
    ];
    globalThis.fromUuid = async uuid => (uuid === "Actor.rit-1" ? { uuid: "Actor.rit-1" } : null);

    await spawnDemonOnScene("Кровожад", "Actor.rit-1");

    expect(created[0]).toMatchObject({ x: 600, y: 700 }); // +grid (100) от ритуалиста
  });
});

describe("маршрутизация вызова (defaultSpawnDemonFn)", () => {
  it("ГМ — вызывает напрямую (Актор/токен создаются на его клиенте)", async () => {
    globalThis.game.user = { isGM: true };
    globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровожад" }]));
    const created = [];
    globalThis.canvas.scene = stubScene({ createdTokens: created });

    await defaultSpawnDemonFn("Кровожад", "Actor.rit-1");

    expect(created.length).toBe(1);
    expect(captured.warnings).toEqual([]);
  });

  it("не ГМ, есть активный ГМ — шлёт сокет-релей, ничего не создаёт сам", async () => {
    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = { id: "gm-1" };
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };

    await defaultSpawnDemonFn("Кровожад", "Actor.rit-1");

    expect(emitted).toEqual([{
      channel: "system.warhammer-dbc",
      data: { action: "summonDemon", userId: "user-1", name: "Кровожад", ritualistUuid: "Actor.rit-1" }
    }]);
  });

  it("не ГМ, нет активного ГМа — предупреждает, не бросает и не шлёт сокет", async () => {
    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = null;
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };

    await defaultSpawnDemonFn("Кровожад", "Actor.rit-1");

    expect(emitted).toEqual([]);
    expect(captured.warnings.some(w => /активного Мастера/.test(w))).toBe(true);
  });

  it("пустое имя демона — ничего не делает", async () => {
    globalThis.game.user = { isGM: true };
    const created = [];
    globalThis.canvas.scene = stubScene({ createdTokens: created });

    await defaultSpawnDemonFn("", "Actor.rit-1");
    expect(created.length).toBe(0);
  });
});
