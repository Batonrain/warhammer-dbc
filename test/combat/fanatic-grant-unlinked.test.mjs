// test/combat/fanatic-grant-unlinked.test.mjs
//
// Back to Back/Спиной к Спине: Fanatic «до конца боя» у НЕсвязанных токенов
// (actorLink:false). Их синтетических акторов (мир + дельта токена) нет в
// game.actors, и раздача/зачистка по game.actors их не видела. Общий обход —
// migrations/unlinked-tokens.mjs::worldAndTokenActors.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { grantFanaticTrait, clearFanaticGrants, hasFanatic } from "../../module/combat/fanatic-redirect.mjs";
import { worldAndTokenActors } from "../../module/migrations/unlinked-tokens.mjs";

const GRANT_FLAG = (source) => ({ "warhammer-dbc": { fanaticGrant: { source } } });

function makeActor({ uuid, id, name, items = [], fel = 0, extra = {} }) {
  const a = {
    uuid, id, name, items: [...items], type: "character", isOwner: true,
    system: { characteristics: { fel: { bonus: fel } } },
    created: [], deleted: [],
    async createEmbeddedDocuments(type, datas) {
      for (const d of datas) { const doc = { ...d, id: `n${a.items.length}` }; a.items.push(doc); a.created.push(doc); }
    },
    async deleteEmbeddedDocuments(type, ids) {
      a.items = a.items.filter(i => !ids.includes(i.id));
      a.deleted.push(...ids);
    },
    ...extra
  };
  return a;
}

function tokenActor(base, tokenId, items = []) {
  return makeActor({
    uuid: `Scene.s.Token.${tokenId}.Actor.${base.id}`, id: base.id, name: base.name, items,
    fel: base.system.characteristics.fel.bonus,
    extra: { isToken: true, token: { baseActor: base } }
  });
}

const squad = (uuid, commanderUuid, memberUuids) => ({
  uuid, type: "squad", items: [],
  system: { posts: { commander: { uuid: commanderUuid } }, members: memberUuids.map(u => ({ uuid: u })) }
});

const fanaticTemplate = { toObject: () => ({ _id: "tpl", type: "trait", name: "Fanatic", flags: {}, system: {} }) };
const grantedItem = (id, source) => ({ id, type: "trait", name: "Fanatic", flags: GRANT_FLAG(source) });
const ownFanatic = { id: "own", type: "trait", name: "Fanatic", flags: {} };

let saved;
beforeEach(() => {
  saved = { actors: game.actors, scenes: game.scenes, fromUuid: globalThis.fromUuid };
  globalThis.fromUuid = async () => fanaticTemplate;
});
afterEach(() => {
  game.actors = saved.actors; game.scenes = saved.scenes; globalThis.fromUuid = saved.fromUuid;
});

const sceneWith = (...actors) => ({ tokens: { contents: actors.map(actor => ({ actorLink: false, actor })) } });

describe("worldAndTokenActors", () => {
  it("мировые акторы и акторы несвязанных токенов, без дублей по uuid", () => {
    const world = makeActor({ uuid: "Actor.w", id: "w", name: "W" });
    const tok = tokenActor(world, "t1");
    game.actors = [world, world];
    game.scenes = [sceneWith(tok), sceneWith(tok)];
    expect(worldAndTokenActors()).toEqual([world, tok]);
  });
});

describe("grantFanaticTrait — несвязанные токены", () => {
  it("командир — несвязанный токен: Черта в его дельте, помечена источником", async () => {
    const base = makeActor({ uuid: "Actor.cmd", id: "cmd", name: "Сержант", fel: 4 });
    const cmd = tokenActor(base, "tc");
    game.actors = [base];
    game.scenes = [sceneWith(cmd)];
    const given = await grantFanaticTrait(cmd);
    expect(given).toEqual(["Сержант"]);
    expect(cmd.created).toHaveLength(1);
    expect(cmd.created[0].flags["warhammer-dbc"].fanaticGrant.source).toBe(cmd.uuid);
    expect(base.created).toHaveLength(0);
  });

  it("подчинённые — несвязанные токены: получают Черту; в отряде записаны токеном", async () => {
    const baseCmd = makeActor({ uuid: "Actor.cmd", id: "cmd", name: "Сержант", fel: 4 });
    const cmd = tokenActor(baseCmd, "tc");
    const baseSub = makeActor({ uuid: "Actor.sub", id: "sub", name: "Рядовой" });
    const sub = tokenActor(baseSub, "ts");
    const sq = squad("Actor.sq", cmd.uuid, [cmd.uuid, sub.uuid]);
    game.actors = [baseCmd, baseSub, sq];
    game.scenes = [sceneWith(cmd, sub)];
    const given = await grantFanaticTrait(cmd);
    expect(given).toEqual(["Сержант", "Рядовой"]);
    expect(sub.created).toHaveLength(1);
    expect(baseSub.created).toHaveLength(0);
  });

  it("подчинённый записан мировым актором, а на сцене — несвязанные токены: Черта токенам, не шаблону", async () => {
    const baseCmd = makeActor({ uuid: "Actor.cmd", id: "cmd", name: "Сержант", fel: 4 });
    const baseSub = makeActor({ uuid: "Actor.sub", id: "sub", name: "Рядовой",
      extra: { prototypeToken: { actorLink: false } } });
    const sub1 = tokenActor(baseSub, "t1");
    const sub2 = tokenActor(baseSub, "t2");
    const sq = squad("Actor.sq", baseCmd.uuid, [baseSub.uuid]);
    game.actors = [baseCmd, baseSub, sq];
    game.scenes = [sceneWith(sub1, sub2)];
    await grantFanaticTrait(baseCmd);
    expect(sub1.created).toHaveLength(1);
    expect(sub2.created).toHaveLength(1);
    expect(baseSub.created).toHaveLength(0);
  });

  it("командир-токен, пост в отряде — мировой uuid: подчинённые находятся", async () => {
    const baseCmd = makeActor({ uuid: "Actor.cmd", id: "cmd", name: "Сержант", fel: 4 });
    const cmd = tokenActor(baseCmd, "tc");
    const baseSub = makeActor({ uuid: "Actor.sub", id: "sub", name: "Рядовой" });
    const sq = squad("Actor.sq", baseCmd.uuid, [baseCmd.uuid, baseSub.uuid]);
    game.actors = [baseCmd, baseSub, sq];
    game.scenes = [sceneWith(cmd)];
    await grantFanaticTrait(cmd);
    expect(baseSub.created).toHaveLength(1);
    expect(baseCmd.created).toHaveLength(0);
  });

  it("связанные акторы: как раньше, один актор в списке дважды Черту дважды не получает", async () => {
    const cmd = makeActor({ uuid: "Actor.cmd", id: "cmd", name: "Сержант", fel: 4 });
    const sub = makeActor({ uuid: "Actor.sub", id: "sub", name: "Рядовой" });
    const sq = squad("Actor.sq", cmd.uuid, [cmd.uuid, sub.uuid, sub.uuid]);
    game.actors = [cmd, sub, sq, sub];
    game.scenes = [];
    await grantFanaticTrait(cmd);
    expect(cmd.created).toHaveLength(1);
    expect(sub.created).toHaveLength(1);
  });

  it("повторная раздача снимает прежнюю у токена и не трогает собственную Черту", async () => {
    const baseCmd = makeActor({ uuid: "Actor.cmd", id: "cmd", name: "Сержант", fel: 4 });
    const cmd = tokenActor(baseCmd, "tc");
    const baseSub = makeActor({ uuid: "Actor.sub", id: "sub", name: "Рядовой" });
    const sub = tokenActor(baseSub, "ts", [grantedItem("old", cmd.uuid)]);
    const sq = squad("Actor.sq", cmd.uuid, [cmd.uuid, sub.uuid]);
    game.actors = [baseCmd, baseSub, sq];
    game.scenes = [sceneWith(cmd, sub)];
    await grantFanaticTrait(cmd);
    expect(sub.deleted).toEqual(["old"]);
    expect(sub.items.filter(i => i.flags?.["warhammer-dbc"]?.fanaticGrant)).toHaveLength(1);

    const own = tokenActor(baseSub, "ts2", [ownFanatic]);
    game.scenes = [sceneWith(cmd, own)];
    const sq2 = squad("Actor.sq", cmd.uuid, [cmd.uuid, own.uuid]);
    game.actors = [baseCmd, baseSub, sq2];
    await grantFanaticTrait(cmd);
    expect(own.created).toHaveLength(0);
    expect(own.deleted).toEqual([]);
    expect(own.items).toContain(ownFanatic);
  });
});

describe("clearFanaticGrants — несвязанные токены", () => {
  it("снимает выданное в дельте токена, собственное не трогает, связанных обходит как раньше", async () => {
    const base = makeActor({ uuid: "Actor.b", id: "b", name: "Б" });
    const tok = tokenActor(base, "t1", [grantedItem("g1", "x"), ownFanatic]);
    const linked = makeActor({ uuid: "Actor.l", id: "l", name: "Л", items: [grantedItem("g2", "x")] });
    game.actors = [base, linked];
    game.scenes = [sceneWith(tok)];
    await clearFanaticGrants();
    expect(tok.deleted).toEqual(["g1"]);
    expect(hasFanatic(tok)).toBe(true);
    expect(tok.items).toEqual([ownFanatic]);
    expect(linked.deleted).toEqual(["g2"]);
    expect(base.deleted).toEqual([]);
  });

  it("один актор в списке дважды: удаление один раз", async () => {
    const a = makeActor({ uuid: "Actor.a", id: "a", name: "А", items: [grantedItem("g1", "x")] });
    await clearFanaticGrants([a, a]);
    expect(a.deleted).toEqual(["g1"]);
  });
});
