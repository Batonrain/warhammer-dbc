// test/combat/the-hunter.test.mjs
//
// The Hunter / Загонщик (wdbc-1rno, Кхорн) — spawnHunterHound (призыв +
// метка HUNTER_HOUND_FLAG + инициатива «сразу после чемпиона», тот же
// приём, что module/combat/spirit-talk.mjs), defaultSpawnHunterHoundFn
// (ГМ/сокет-релей, тот же приём, что demon-summon.mjs::defaultSpawnDemonFn),
// huntReturnToWarpButtonHtml (кнопка карточки «Констатировать смерть»).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import {
  spawnHunterHound, defaultSpawnHunterHoundFn, huntReturnToWarpButtonHtml
} from "../../module/combat/the-hunter.mjs";
import { HUNTER_HOUND_FLAG } from "../../module/rules/the-hunter.mjs";

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
    grid: { size: 100, distance: 2 },
    tokens: { contents: [] },
    createEmbeddedDocuments: async (type, docs) => { createdTokens.push(...docs); return docs; }
  };
}

/** Подставной Combatant — тот же приём, что spirit-talk.test.mjs. */
function combatant({ id, actorId, initiative = null }) {
  return { id, actorId, initiative, update: async data => { if (data.initiative !== undefined) combatants_setInit(id, data.initiative); } };
}
// (мутируем через замыкание массива fakeCombat, не отдельный реестр — проще пробросить update в конструкторе ниже)
function combatants_setInit() {}

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

let createdActors;
const actorRegistry = new Map();

function makeActor({ id, name, uuid, isPsyker = false } = {}) {
  const flags = {};
  const actor = {
    id, name, uuid: uuid ?? `Actor.${id}`,
    system: { isPsyker },
    items: [],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    getActiveTokens: (linked, document) => []
  };
  actorRegistry.set(actor.uuid, actor);
  return actor;
}

beforeEach(() => {
  resetCaptured();
  actorRegistry.clear();
  globalThis.game.user = { isGM: true };
  globalThis.game.users = { activeGM: globalThis.game.user };
  globalThis.game.packs = new Map();
  globalThis.canvas = { scene: null, tokens: { placeables: [] } };
  globalThis.game.scenes = { current: null };
  globalThis.game.combat = undefined;
  globalThis.game.socket = { emit: () => {} };
  createdActors = [];
  globalThis.Actor.create = async data => {
    const flags = {};
    const actor = {
      ...data, name: data.name, uuid: `Actor.${data.name}`,
      getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ name: data.name, x, y }) }),
      getFlag: (scope, key) => flags[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
      unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
      getActiveTokens: () => []
    };
    createdActors.push(actor);
    actorRegistry.set(actor.uuid, actor);
    return actor;
  };
  globalThis.fromUuid = async uuid => actorRegistry.get(uuid) ?? null;
});

describe("spawnHunterHound", () => {
  it("чемпион не резолвится — ok:false, ничего не создано", async () => {
    const res = await spawnHunterHound("Actor.unknown", "item-1");
    expect(res.ok).toBe(false);
    expect(createdActors.length).toBe(0);
  });

  it("Гончая не найдена в Бестиарии — ok:false прокидывается как есть, флаг не пишется", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.game.packs.set("warhammer-dbc.bestiary", bestiaryPack([]));
    globalThis.canvas.scene = stubScene();

    const res = await spawnHunterHound(champion.uuid, "item-1");
    expect(res.ok).toBe(false);
    expect(createdActors.length).toBe(0);
  });

  it("успех: Актор создан, метка HUNTER_HOUND_FLAG несёт championUuid+itemId, публичная карточка", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    globalThis.canvas.scene = stubScene();

    const res = await spawnHunterHound(champion.uuid, "item-1");
    expect(res.ok).toBe(true);
    expect(createdActors.length).toBe(1);
    const hound = createdActors[0];
    expect(hound.getFlag("warhammer-dbc", HUNTER_HOUND_FLAG)).toEqual({ championUuid: champion.uuid, itemId: "item-1" });

    const card = captured.chat.at(-1);
    expect(card.content).toContain("Загонщик");
    expect(card.content).toContain("Из Варпа явилась");
    expect(card.whisper).toBeUndefined(); // публичная карточка, не только ГМу
  });

  it("вне боя (game.combat не задан) — Combatant не заводится, без ошибки", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    globalThis.canvas.scene = stubScene();
    globalThis.game.combat = undefined;

    const res = await spawnHunterHound(champion.uuid, "item-1");
    expect(res.ok).toBe(true); // не падает
  });

  it("бой идёт, у чемпиона есть Combatant — Гончая получает свой Combatant с инициативой чуть ниже", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    globalThis.canvas.scene = stubScene();
    const combat = fakeCombat({ existing: [{ id: "c-champ", actorId: "champ", initiative: 40 }] });
    globalThis.game.combat = combat;

    await spawnHunterHound(champion.uuid, "item-1");

    expect(combat.combatants.length).toBe(2);
    const houndCombatant = combat.combatants.find(c => c.actorId !== "champ");
    expect(houndCombatant.initiative).toBeCloseTo(39.99);
  });

  it("бой идёт, но у чемпиона ЕЩЁ НЕТ Combatant — Гончей тоже не заводится (нечего ставить «сразу после»)", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    globalThis.canvas.scene = stubScene();
    const combat = fakeCombat({ existing: [] });
    globalThis.game.combat = combat;

    await spawnHunterHound(champion.uuid, "item-1");
    expect(combat.combatants.length).toBe(0);
  });

  it("подсказка «ближайший псайкер» — есть, когда псайкер виден с токена чемпиона", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    champion.getActiveTokens = () => [{ id: "champ-tok", x: 0, y: 0, width: 1, height: 1, hidden: false, parent: scene }];
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    const psyker = { id: "psyker-tok", x: 300, y: 0, width: 1, height: 1, hidden: false, actor: { name: "Псайкер", system: { isPsyker: true } } };
    var scene = stubScene(); // eslint-disable-line no-var
    scene.tokens.contents = [champion.getActiveTokens()[0], psyker];
    globalThis.canvas.scene = scene;

    await spawnHunterHound(champion.uuid, "item-1");
    const card = captured.chat.at(-1);
    expect(card.content).toContain("Ближайший видимый псайкер");
    expect(card.content).toContain("Псайкер");
  });

  it("подсказка отсутствует — псайкера в поле зрения нет", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    champion.getActiveTokens = () => [{ id: "champ-tok", x: 0, y: 0, width: 1, height: 1, hidden: false }];
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    const scene = stubScene();
    scene.tokens.contents = [champion.getActiveTokens()[0]];
    globalThis.canvas.scene = scene;

    await spawnHunterHound(champion.uuid, "item-1");
    const card = captured.chat.at(-1);
    expect(card.content).not.toContain("Ближайший видимый псайкер");
  });
});

describe("defaultSpawnHunterHoundFn", () => {
  it("ГМ — призывает напрямую", async () => {
    const champion = makeActor({ id: "champ", name: "Чемпион" });
    globalThis.game.packs.set("warhammer-dbc.bestiary",
      bestiaryPack([{ _id: "d1", name: "Гончая Плоти" }]));
    globalThis.canvas.scene = stubScene();
    globalThis.game.user = { isGM: true };

    await defaultSpawnHunterHoundFn(champion.uuid, "item-1");
    expect(createdActors.length).toBe(1);
  });

  it("не ГМ, есть активный ГМ — сокет-релей с championUuid/itemId", async () => {
    globalThis.game.user = { isGM: false, id: "player-1" };
    globalThis.game.users = { activeGM: { id: "gm-1" } };
    let emitted = null;
    globalThis.game.socket = { emit: (channel, data) => { emitted = { channel, data }; } };

    await defaultSpawnHunterHoundFn("Actor.champ", "item-1");

    expect(emitted.channel).toBe("system.warhammer-dbc");
    expect(emitted.data).toEqual({ action: "summonHunterHound", userId: "player-1", championUuid: "Actor.champ", itemId: "item-1" });
    expect(createdActors.length).toBe(0); // не выполняется на этом клиенте
  });

  it("не ГМ, нет активного ГМа — предупреждение, ничего не отправляется", async () => {
    globalThis.game.user = { isGM: false, id: "player-1" };
    globalThis.game.users = { activeGM: null };
    let emitted = false;
    globalThis.game.socket = { emit: () => { emitted = true; } };

    await defaultSpawnHunterHoundFn("Actor.champ", "item-1");
    expect(emitted).toBe(false);
  });
});

describe("huntReturnToWarpButtonHtml", () => {
  it("нет актора — пусто", () => {
    expect(huntReturnToWarpButtonHtml(null)).toBe("");
  });

  it("есть актор — кнопка несёт data-actor-uuid", () => {
    const html = huntReturnToWarpButtonHtml({ uuid: "Actor.hound-1" });
    expect(html).toContain("wh-hunter-warp-btn");
    expect(html).toContain('data-actor-uuid="Actor.hound-1"');
    expect(html).toContain("Гончая возвращается в Варп");
  });
});
