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

let createdActors;

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = {};
  globalThis.game.users = { activeGM: null };
  globalThis.game.packs = new Map();
  globalThis.canvas = { scene: null, tokens: { placeables: [] } };
  globalThis.game.scenes = { current: null };
  createdActors = [];
  globalThis.Actor.create = async data => {
    const actor = {
      ...data, name: data.name, uuid: `Actor.${data.name}`,
      getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ name: data.name, x, y }) })
    };
    createdActors.push(actor);
    return actor;
  };
  globalThis.fromUuid = async () => null;
});

describe("поиск и создание демона на сцене (spawnDemonOnScene)", () => {
  it("демон найден в Бестиарии по русской части имени — Актор и токен создаются", async () => {
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Bloodthirster / Кровожад" }]));
    const created = [];
    globalThis.canvas.scene = stubScene({ createdTokens: created });

    const res = await spawnDemonOnScene("Кровожад");

    expect(res).toEqual({ ok: true, actorName: "Bloodthirster / Кровожад", actorUuid: "Actor.Bloodthirster / Кровожад" });
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

  // wdbc-1rno: Инфернальный Оруженосец/Рыцарь Бога — «контролировать как
  // Миньона без траты слотов Миньонов».
  describe("asMinion — призванный демон привязывается Миньоном без слота", () => {
    it("ritualistUuid проставляется в system.masterUuid созданного Актора", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.canvas.scene = stubScene();

      const res = await spawnDemonOnScene("Кровопускатель", "Actor.champion-1", { asMinion: true });

      expect(res.ok).toBe(true);
      expect(createdActors[0].system?.masterUuid).toBe("Actor.champion-1");
    });

    it("без asMinion (по умолчанию) masterUuid не проставляется", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.canvas.scene = stubScene();

      await spawnDemonOnScene("Кровопускатель", "Actor.champion-1");

      expect(createdActors[0].system?.masterUuid).toBeUndefined();
    });

    it("asMinion без ritualistUuid — не ставит masterUuid (некому)", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.canvas.scene = stubScene();

      const res = await spawnDemonOnScene("Кровопускатель", "", { asMinion: true });

      expect(res.ok).toBe(true);
      expect(createdActors[0].system?.masterUuid).toBeUndefined();
    });

    // wdbc-1rno, шаг E: тот же флаг, что у демон-оружия (module/apps/
    // armiger-weapon.mjs) — module/rules/dominator.mjs::isOwnArmiger по нему
    // отличает СВОЕГО Оруженосца от любого другого купленного Миньона.
    it("asMinion+ritualistUuid — актор получает флаг armigerBound", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.canvas.scene = stubScene();

      await spawnDemonOnScene("Кровопускатель", "Actor.champion-1", { asMinion: true });

      expect(createdActors[0].flags?.["warhammer-dbc"]?.armigerBound).toBe(true);
    });

    it("без asMinion — флаг armigerBound не проставляется", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.canvas.scene = stubScene();

      await spawnDemonOnScene("Кровопускатель", "Actor.champion-1");

      expect(createdActors[0].flags?.["warhammer-dbc"]?.armigerBound).toBeUndefined();
    });

    // wdbc-1rno, шаг F: «...считает Завесу на Cor.b персонажа тоньше» —
    // выдаётся Чертой (packs-src/traits/Thinner_Veil...), а не готовым
    // эффектом, ровно как остальные выдачи Конструктора.
    it("asMinion — актор получает Черту «Тоньше Завесы» из пака traits", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.game.packs.set("warhammer-dbc.traits", {
        getDocument: async id => (id === "ArmigerVeilThinX1a"
          ? { toObject: () => ({ _id: "ArmigerVeilThinX1a", type: "trait", name: "Thinner Veil" }) } : null)
      });
      globalThis.canvas.scene = stubScene();

      await spawnDemonOnScene("Кровопускатель", "Actor.champion-1", { asMinion: true });

      expect(createdActors[0].items).toEqual([{ type: "trait", name: "Thinner Veil" }]);
    });

    it("нет пака traits или Черта не найдена — призыв не падает, просто без Черты", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
      globalThis.canvas.scene = stubScene();

      const res = await spawnDemonOnScene("Кровопускатель", "Actor.champion-1", { asMinion: true });

      expect(res.ok).toBe(true);
      expect(createdActors[0].items ?? []).toEqual([]);
    });

    it("Бестиарный демон с УЖЕ имеющимися предметами не теряет их — Черта дописывается", async () => {
      globalThis.game.packs.set("warhammer-dbc.bestiary",
        bestiaryPack([{ _id: "d1", name: "Кровопускатель", items: [{ type: "weapon", name: "Адский Клинок" }] }]));
      globalThis.game.packs.set("warhammer-dbc.traits", {
        getDocument: async id => (id === "ArmigerVeilThinX1a"
          ? { toObject: () => ({ _id: "ArmigerVeilThinX1a", type: "trait", name: "Thinner Veil" }) } : null)
      });
      globalThis.canvas.scene = stubScene();

      await spawnDemonOnScene("Кровопускатель", "Actor.champion-1", { asMinion: true });

      expect(createdActors[0].items).toEqual([
        { type: "weapon", name: "Адский Клинок" }, { type: "trait", name: "Thinner Veil" }
      ]);
    });
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
      data: { action: "summonDemon", userId: "user-1", name: "Кровожад", ritualistUuid: "Actor.rit-1", asMinion: false }
    }]);
  });

  it("asMinion:true доезжает и до прямого вызова, и до сокет-релея", async () => {
    globalThis.game.user = { isGM: true };
    globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([{ _id: "d1", name: "Кровопускатель" }]));
    globalThis.canvas.scene = stubScene();

    await defaultSpawnDemonFn("Кровопускатель", "Actor.rit-1", { asMinion: true });
    expect(createdActors[0]?.system?.masterUuid).toBe("Actor.rit-1");

    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = { id: "gm-1" };
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };
    await defaultSpawnDemonFn("Кровопускатель", "Actor.rit-1", { asMinion: true });
    expect(emitted[0].data.asMinion).toBe(true);
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
