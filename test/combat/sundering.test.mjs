// test/combat/sundering.test.mjs
//
// Sundering / Разделение (wdbc-1rno, Тзинч) — spawnSunderingCopies (клон
// САМОГО чемпиона, не бестиарный статблок; скрывает токен чемпиона;
// синхронизирует инициативу копий), defaultSpawnSunderingFn (ГМ/сокет-
// релей, тот же приём, что the-hunter.mjs), revertSunderingOnSceneEnd
// (конец сцены — удаляет копии, чемпион возвращается с 0 Ран).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import {
  spawnSunderingCopies, defaultSpawnSunderingFn, revertSunderingOnSceneEnd
} from "../../module/combat/sundering.mjs";
import { SUNDERING_COPY_FLAG, SUNDERING_ACTIVE_FLAG } from "../../module/rules/sundering.mjs";

function stubScene({ createdTokens = [] } = {}) {
  return {
    dimensions: { width: 2000, height: 2000 },
    grid: { size: 100, distance: 2 },
    createEmbeddedDocuments: async (type, docs) => {
      const placed = docs.map((d, i) => ({ id: `token-${createdTokens.length + i}`, ...d }));
      createdTokens.push(...placed);
      return placed;
    }
  };
}

function fakeCombat({ existing = [] } = {}) {
  const combatants = existing.map(e => {
    const c = { id: e.id, actorId: e.actorId, initiative: e.initiative ?? null };
    c.update = async data => { if (data.initiative !== undefined) c.initiative = data.initiative; };
    return c;
  });
  let nextId = 100;
  return {
    combatants,
    async createEmbeddedDocuments(type, docs) {
      const created = docs.map(d => {
        const c = { id: `combatant-${nextId++}`, actorId: d.actorId, tokenId: d.tokenId ?? null, initiative: d.initiative ?? null };
        c.update = async data => { if (data.initiative !== undefined) c.initiative = data.initiative; };
        return c;
      });
      combatants.push(...created);
      return created;
    }
  };
}

let createdActors, deletedActorUuids;
const actorRegistry = new Map();

function makeToken({ x = 0, y = 0, hidden = false } = {}) {
  const t = { id: `tok-${Math.random()}`, x, y, hidden };
  t.update = async data => Object.assign(t, data);
  return t;
}

function makeActor({ id, name, uuid, token = null, system = {}, items = [] } = {}) {
  const flags = {};
  const actor = {
    id, name, uuid: uuid ?? `Actor.${id}`,
    system: { characteristics: { s: { base: 35 }, t: { base: 40 } }, wounds: { value: -3, max: 12, critical: -2 }, size: 0, ...system },
    items,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        // "flags.<scope>.<key...>" — та же плоская flags-таблица, что читают
        // getFlag/setFlag выше, а не буквальное вложенное поле actor.flags.
        if (parts[0] === "flags") {
          const scope = parts[1];
          const rest = parts.slice(2).join(".");
          if (rest.startsWith("-=")) delete flags[`${scope}.${rest.slice(2)}`];
          else flags[`${scope}.${rest}`] = v;
          continue;
        }
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    },
    getActiveTokens: () => (token ? [token] : []),
    toObject: () => ({ name, system: JSON.parse(JSON.stringify(actor.system)), items: JSON.parse(JSON.stringify(items)) }),
    delete: async () => { deletedActorUuids.push(actor.uuid); actorRegistry.delete(actor.uuid); }
  };
  actorRegistry.set(actor.uuid, actor);
  return actor;
}

beforeEach(() => {
  resetCaptured();
  actorRegistry.clear();
  createdActors = [];
  deletedActorUuids = [];
  globalThis.game.user = { isGM: true };
  globalThis.game.users = { activeGM: globalThis.game.user };
  globalThis.game.actors = [];
  globalThis.canvas = { scene: null };
  globalThis.game.scenes = { current: null };
  globalThis.game.combat = undefined;
  globalThis.game.socket = { emit: () => {} };
  globalThis.Actor.create = async data => {
    // Флаги переданы уже готовыми в data.flags (createSunderingCopy кладёт
    // их ДО Actor.create) — плоская таблица читает вложенный объект целиком,
    // а не стартует с пустого места, как у the-hunter.test.mjs (там флаг
    // ставится ПОСЛЕ создания через .setFlag, здесь — ДО, внутри data).
    const flags = {};
    for (const [scope, bag] of Object.entries(data.flags ?? {})) {
      for (const [key, value] of Object.entries(bag ?? {})) flags[`${scope}.${key}`] = value;
    }
    const actor = {
      ...data, id: `created-${createdActors.length}`, name: data.name, uuid: `Actor.${data.name}`,
      getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ x, y }) }),
      getFlag: (scope, key) => flags[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
      unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
      getActiveTokens: () => [],
      delete: async () => { deletedActorUuids.push(actor.uuid); actorRegistry.delete(actor.uuid); }
    };
    createdActors.push(actor);
    actorRegistry.set(actor.uuid, actor);
    return actor;
  };
  globalThis.fromUuid = async uuid => actorRegistry.get(uuid) ?? null;
});

describe("spawnSunderingCopies", () => {
  it("чемпион не резолвится — ok:false, ничего не создано", async () => {
    const res = await spawnSunderingCopies("Actor.unknown");
    expect(res.ok).toBe(false);
    expect(createdActors.length).toBe(0);
  });

  it("нет активной сцены — ok:false", async () => {
    makeActor({ id: "champ", name: "Чемпион" });
    globalThis.canvas.scene = null;
    const res = await spawnSunderingCopies("Actor.champ");
    expect(res.ok).toBe(false);
  });

  it("успех: две копии созданы, S/T−20 и 9 Ран и Размер−1, метка SUNDERING_COPY_FLAG", async () => {
    makeActor({ id: "champ", name: "Чемпион", system: { characteristics: { s: { base: 35 }, t: { base: 40 } }, wounds: { value: 8, max: 12 }, size: 1 } });
    globalThis.canvas.scene = stubScene();

    const res = await spawnSunderingCopies("Actor.champ");
    expect(res.ok).toBe(true);
    expect(createdActors.length).toBe(2);

    for (const copy of createdActors) {
      expect(copy.system.characteristics.s.base).toBe(15);
      expect(copy.system.characteristics.t.base).toBe(20);
      expect(copy.system.wounds).toEqual({ value: 9, max: 9, critical: 0 });
      expect(copy.system.size).toBe(0);
      expect(copy.getFlag("warhammer-dbc", SUNDERING_COPY_FLAG).championUuid).toBe("Actor.champ");
      expect(copy.items.some(i => i.name.includes("Daemonic"))).toBe(true);
    }
  });

  it("успех: чемпион получает флаг SUNDERING_ACTIVE_FLAG с обоими uuid копий", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.canvas.scene = stubScene();
    await spawnSunderingCopies("Actor.champ");
    const active = champion.getFlag("warhammer-dbc", SUNDERING_ACTIVE_FLAG);
    expect(active.copyUuids).toHaveLength(2);
    expect(active.copyUuids).toEqual(createdActors.map(a => a.uuid));
  });

  it("токен чемпиона скрывается («тело исчезло»)", async () => {
    const token = makeToken({ x: 100, y: 100 });
    makeActor({ id: "champ", name: "Чемпион", token });
    globalThis.canvas.scene = stubScene();
    await spawnSunderingCopies("Actor.champ");
    expect(token.hidden).toBe(true);
  });

  it("вне боя — Combatant не заводится, не падает", async () => {
    makeActor({ id: "champ", name: "Чемпион" });
    globalThis.canvas.scene = stubScene();
    globalThis.game.combat = undefined;
    const res = await spawnSunderingCopies("Actor.champ");
    expect(res.ok).toBe(true);
  });

  it("бой идёт, чемпион уже в нём — обе копии получают Combatant с разной, чуть меньшей инициативой", async () => {
    makeActor({ id: "champ", name: "Чемпион" });
    globalThis.canvas.scene = stubScene();
    const combat = fakeCombat({ existing: [{ id: "c-champ", actorId: "champ", initiative: 40 }] });
    globalThis.game.combat = combat;

    await spawnSunderingCopies("Actor.champ");

    expect(combat.combatants.length).toBe(3); // чемпион + 2 копии
    const copyInits = combat.combatants.filter(c => c.actorId !== "champ").map(c => c.initiative).sort((a, b) => b - a);
    expect(copyInits[0]).toBeCloseTo(39.99);
    expect(copyInits[1]).toBeCloseTo(39.98);
  });
});

describe("defaultSpawnSunderingFn", () => {
  it("ГМ — создаёт напрямую", async () => {
    makeActor({ id: "champ", name: "Чемпион" });
    globalThis.canvas.scene = stubScene();
    await defaultSpawnSunderingFn("Actor.champ");
    expect(createdActors.length).toBe(2);
  });

  it("не ГМ, есть активный ГМ — сокет-релей", async () => {
    globalThis.game.user = { isGM: false, id: "player-1" };
    globalThis.game.users = { activeGM: { id: "gm-1" } };
    let emitted = null;
    globalThis.game.socket = { emit: (channel, data) => { emitted = { channel, data }; } };

    await defaultSpawnSunderingFn("Actor.champ");
    expect(emitted).toEqual({ channel: "system.warhammer-dbc", data: { action: "spawnSundering", userId: "player-1", championUuid: "Actor.champ" } });
    expect(createdActors.length).toBe(0);
  });

  it("не ГМ, нет активного ГМа — предупреждение, ничего не отправляется", async () => {
    globalThis.game.user = { isGM: false, id: "player-1" };
    globalThis.game.users = { activeGM: null };
    let emitted = false;
    globalThis.game.socket = { emit: () => { emitted = true; } };
    await defaultSpawnSunderingFn("Actor.champ");
    expect(emitted).toBe(false);
  });
});

describe("revertSunderingOnSceneEnd", () => {
  it("нет ни одного актора с активным Разделением — ничего не делает", async () => {
    makeActor({ id: "a1", name: "Обычный" });
    await expect(revertSunderingOnSceneEnd()).resolves.toBeUndefined();
  });

  it("удаляет обе копии, возвращает чемпиона с 0 Ран и снимает deceased/флаг", async () => {
    const copy1Token = makeToken({ x: 300, y: 300 });
    const copy2Token = makeToken({ x: 400, y: 400 });
    const copy1 = makeActor({ id: "copy1", name: "Копия 1", token: copy1Token });
    const copy2 = makeActor({ id: "copy2", name: "Копия 2", token: copy2Token });
    const championToken = makeToken({ x: 100, y: 100, hidden: true });
    const champion = makeActor({ id: "champ", name: "Чемпион", token: championToken,
      system: { wounds: { value: -5, max: 12, critical: -3 } } });
    await champion.setFlag("warhammer-dbc", SUNDERING_ACTIVE_FLAG, { copyUuids: [copy1.uuid, copy2.uuid], tokenHidden: true });
    globalThis.game.actors = [champion, copy1, copy2];

    // Диалог выбора между двумя позициями — тест сам «нажимает» первую кнопку.
    globalThis.Dialog = class {
      constructor(cfg) { this._cfg = cfg; }
      render() { this._cfg.buttons.first.callback(); }
    };

    await revertSunderingOnSceneEnd();

    expect(deletedActorUuids.sort()).toEqual([copy1.uuid, copy2.uuid].sort());
    expect(champion.system.wounds.value).toBe(0);
    expect(champion.system.wounds.critical).toBe(0);
    expect(champion.getFlag("warhammer-dbc", "deceased")).toBe(false);
    expect(champion.getFlag("warhammer-dbc", SUNDERING_ACTIVE_FLAG)).toBeUndefined();
    expect(championToken.x).toBe(300);
    expect(championToken.y).toBe(300);
    expect(championToken.hidden).toBe(false);
  });

  it("нет флага активного Разделения на других акторах — их токены/раны не трогает", async () => {
    const untouched = makeActor({ id: "u1", name: "Прохожий", system: { wounds: { value: 5, max: 10 } } });
    globalThis.game.actors = [untouched];
    await revertSunderingOnSceneEnd();
    expect(untouched.system.wounds.value).toBe(5);
  });
});
