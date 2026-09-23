// test/migrations/duplicate-origin-cleanup.test.mjs
//
// wdbc-gbpe: гонка в apply(Homeworld|Divination)(Picks) (см. module/apps/
// origin-shared.mjs::withOriginLock) могла оставить у уже сыгранных
// персонажей ВТОРОЙ, «осиротевший» носитель Родного мира/Предсказания —
// сама гонка починена, эта миграция подчищает то, что уже успело задвоиться.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { migrateDuplicateOrigins } from "../../module/migrations/duplicate-origin-cleanup.mjs";

const FLAG = "warhammer-dbc";

function fakeItem(id, type, grant = null, grantedByItem = null) {
  const flags = { [FLAG]: {} };
  if (grant) flags[FLAG].originGrant = grant;
  if (grantedByItem) flags[FLAG].grantedByItem = grantedByItem;
  return { id, type, flags, getFlag: (scope, key) => flags[scope]?.[key] };
}

function actorWith(id, items, { throwOnDelete = false } = {}) {
  const list = [...items];
  list.get = itemId => list.find(i => i.id === itemId) ?? null;
  const actor = {
    id, name: `Actor ${id}`, items: list,
    system: { skills: {}, groupSkills: {}, wounds: { max: 10 } },
    update: async () => {},
    async deleteEmbeddedDocuments(_type, ids) {
      if (throwOnDelete) throw new Error(`boom on ${id}`);
      for (const delId of ids) {
        const idx = list.findIndex(i => i.id === delId);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
  };
  return actor;
}

describe("migrateDuplicateOrigins", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  it("два носителя homeworld — держит первый, второй и его выдачу сносит", async () => {
    const actor = actorWith("a1", [
      fakeItem("hw-1", "homeworld"),
      fakeItem("hw-2", "homeworld"),
      fakeItem("trait-from-1", "trait", "homeworld", "hw-1"), // выдача ПЕРВОГО — остаётся
      fakeItem("trait-from-2", "trait", "homeworld", "hw-2")  // выдача второго — снимается вместе с ним
    ]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateDuplicateOrigins();

    expect(res.actorCount).toBe(1);
    expect(res.failed).toBe(0);
    expect(actor.items.map(i => i.id).sort()).toEqual(["hw-1", "trait-from-1"]);
  });

  // wdbc-bjy1.8: соглашение соседних миграций — второй прогон ничего не находит.
  it("повторный прогон идемпотентен — второй раз чистить нечего", async () => {
    const actor = actorWith("a1", [
      fakeItem("hw-1", "homeworld"),
      fakeItem("hw-2", "homeworld"),
      fakeItem("trait-from-2", "trait", "homeworld", "hw-2")
    ]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    expect((await migrateDuplicateOrigins()).actorCount).toBe(1);
    const after = actor.items.map(i => i.id);
    const again = await migrateDuplicateOrigins();
    expect(again).toEqual({ actorCount: 0, failed: 0 });
    expect(actor.items.map(i => i.id)).toEqual(after);
  });

  it("ровно один носитель каждого вида — не трогает ничего", async () => {
    const actor = actorWith("a2", [fakeItem("hw-1", "homeworld"), fakeItem("dv-1", "divination")]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateDuplicateOrigins();

    expect(res.actorCount).toBe(0);
    expect(actor.items.map(i => i.id).sort()).toEqual(["dv-1", "hw-1"]);
  });

  it("три носителя divination — держит первый, сносит оба лишних", async () => {
    const actor = actorWith("a3", [fakeItem("dv-1", "divination"), fakeItem("dv-2", "divination"), fakeItem("dv-3", "divination")]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateDuplicateOrigins();

    expect(res.actorCount).toBe(2);
    expect(actor.items.map(i => i.id)).toEqual(["dv-1"]);
  });

  it("оба вида задвоены одновременно — оба чинятся", async () => {
    const actor = actorWith("a4", [
      fakeItem("hw-1", "homeworld"), fakeItem("hw-2", "homeworld"),
      fakeItem("dv-1", "divination"), fakeItem("dv-2", "divination")
    ]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateDuplicateOrigins();

    expect(res.actorCount).toBe(2);
    expect(actor.items.map(i => i.id).sort()).toEqual(["dv-1", "hw-1"]);
  });

  // Тот же приём, что gene-seed-cleanup.test.mjs (wdbc-059h) — сбой на одном
  // акторе не должен глушить чистку остальным молча.
  it("сбой на одном акторе не прерывает чистку остальным", async () => {
    const bad = actorWith("bad", [fakeItem("hw-1", "homeworld"), fakeItem("hw-2", "homeworld")], { throwOnDelete: true });
    const good = actorWith("good", [fakeItem("hw-1", "homeworld"), fakeItem("hw-2", "homeworld")]);
    globalThis.game = { user: { isGM: true }, actors: [bad, good], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateDuplicateOrigins();

    expect(res.failed).toBe(1);
    expect(res.actorCount).toBe(1);
    expect(good.items.map(i => i.id)).toEqual(["hw-1"]);
    expect(bad.items.map(i => i.id).sort()).toEqual(["hw-1", "hw-2"]); // не тронут
  });

  it("не-ГМ — предупреждает и ничего не делает", async () => {
    const actor = actorWith("a5", [fakeItem("hw-1", "homeworld"), fakeItem("hw-2", "homeworld")]);
    globalThis.game = { user: { isGM: false }, actors: [actor], scenes: [] };
    let warned = "";
    globalThis.ui = { notifications: { warn: (m) => { warned = m; } } };

    const res = await migrateDuplicateOrigins();

    expect(res).toBeUndefined();
    expect(warned).toContain("только для ГМа");
    expect(actor.items.map(i => i.id).sort()).toEqual(["hw-1", "hw-2"]);
  });

  it("несвязанный токен сцены (actorLink:false) — тоже чистится", async () => {
    const actor = actorWith("t1", [fakeItem("hw-1", "homeworld"), fakeItem("hw-2", "homeworld")]);
    const tokenDoc = { name: "Токен", actorLink: false, actor };
    globalThis.game = { user: { isGM: true }, actors: [], scenes: [{ name: "Сцена", tokens: { contents: [tokenDoc] } }] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateDuplicateOrigins();

    expect(res.actorCount).toBe(1);
    expect(actor.items.map(i => i.id)).toEqual(["hw-1"]);
  });
});
