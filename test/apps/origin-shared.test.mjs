// test/apps/origin-shared.test.mjs
//
// wdbc-gbpe: дублирование Мир-улей/расовых Черт на живом акторе — корень в
// module/apps/origin-shared.mjs::clearGrantedBy (не подчищала «осиротевшие»
// вторые носители homeworld/divination, у которых сам предмет-носитель НЕ
// самотегируется GRANT) и в отсутствии замка на «clear, потом grant»
// (applyHomeworld/applyDivinationPicks/applyLegion — конкурентный вызов,
// например character-wizard.mjs звал .then(...) без await, создавал второй
// носитель раньше, чем первый успевал снести себя же).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { clearGrantedBy, withOriginLock } from "../../module/apps/origin-shared.mjs";

const FLAG = "warhammer-dbc";

function fakeItem(id, type, { grant = null, skillRanks = null, woundBonus = 0 } = {}) {
  const flags = { [FLAG]: {} };
  if (grant) flags[FLAG].originGrant = grant;
  if (skillRanks) flags[FLAG].skillRanks = skillRanks;
  if (woundBonus) flags[FLAG].woundBonus = woundBonus;
  return { id, type, flags, getFlag: (scope, key) => flags[scope]?.[key] };
}

function actorStub(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    id: "actor-1", uuid: "Actor.actor-1",
    system: { skills: {}, groupSkills: {}, wounds: { max: 10 } },
    items: list, updates: [], deleted: [],
    update: async data => { actor.updates.push(data); Object.assign(actor.system, {}); return data; },
    deleteEmbeddedDocuments: async (_type, ids) => { actor.deleted.push(...ids); return ids; }
  };
  return actor;
}

describe("clearGrantedBy: носитель БЕЗ самотегирования (homeworld/divination) — сирота того же типа сметается", () => {
  it("два носителя одного типа, оба без GRANT-флага на себе — оба уходят", async () => {
    const carrier1 = fakeItem("hw-1", "homeworld");
    const carrier2 = fakeItem("hw-2", "homeworld"); // «осиротевший» дубликат — не self-tagged
    const grantedTrait = fakeItem("trait-1", "trait", { grant: "homeworld" });
    const actor = actorStub([carrier1, carrier2, grantedTrait]);

    await clearGrantedBy(actor, "homeworld", carrier1); // вызывающий нашёл только первый (.find())

    expect(actor.deleted.sort()).toEqual(["hw-1", "hw-2", "trait-1"]);
  });

  it("без дубликата (обычный случай) — поведение как раньше, лишнего не трогает", async () => {
    const carrier1 = fakeItem("hw-1", "homeworld");
    const grantedTrait = fakeItem("trait-1", "trait", { grant: "homeworld" });
    const otherItem = fakeItem("weapon-1", "weapon");
    const actor = actorStub([carrier1, grantedTrait, otherItem]);

    await clearGrantedBy(actor, "homeworld", carrier1);

    expect(actor.deleted.sort()).toEqual(["hw-1", "trait-1"]);
  });

  it("skillRanks/woundBonus обоих осиротевших носителей учитываются, не только первого", async () => {
    const carrier1 = fakeItem("hw-1", "homeworld", { skillRanks: { dodge: { from: "trained", to: "expert" } }, woundBonus: 2 });
    const carrier2 = fakeItem("hw-2", "homeworld", { woundBonus: 3 });
    const actor = actorStub([carrier1, carrier2]);
    actor.system.skills.dodge = { rank: "expert" };

    await clearGrantedBy(actor, "homeworld", carrier1);

    const skillUpd = actor.updates.find(u => "system.skills.dodge.rank" in u);
    expect(skillUpd["system.skills.dodge.rank"]).toBe("trained");
    const woundUpd = actor.updates.find(u => "system.wounds.max" in u);
    expect(woundUpd["system.wounds.max"]).toBe(10 - 2 - 3);
  });
});

describe("clearGrantedBy: носитель С самотегированием (race/subrace/archetype) — чужой тег того же типа НЕ трогается", () => {
  // Регрессия к находке из races-apply.test.mjs: race и racePast — оба
  // item.type «race», различаются только тегом. Первая версия фикса
  // wdbc-gbpe («чистить всё того же типа») сносила Прошлое при чистке расы
  // и наоборот — этот тест держит границу.
  it("два предмета одного типа с РАЗНЫМИ тегами — чистка по одному тегу не задевает другой", async () => {
    const raceCarrier = fakeItem("race-1", "race", { grant: "race" });
    const pastCarrier = fakeItem("past-1", "race", { grant: "racePast" });
    const actor = actorStub([raceCarrier, pastCarrier]);

    await clearGrantedBy(actor, "race", raceCarrier);

    expect(actor.deleted).toEqual(["race-1"]);
  });

  it("два самотегированных носителя одного тега (дубликат-гонка) — оба ловятся granted-фильтром без спец-логики", async () => {
    const dup1 = fakeItem("race-1", "race", { grant: "race" });
    const dup2 = fakeItem("race-2", "race", { grant: "race" }); // возник из гонки apply
    const actor = actorStub([dup1, dup2]);

    await clearGrantedBy(actor, "race", dup1);

    expect(actor.deleted.sort()).toEqual(["race-1", "race-2"]);
  });
});

describe("withOriginLock: очередь на actor+tag, не запрет — гонка clear/grant закрывается", () => {
  it("второй вызов стартует только после того, как первый ЗАВЕРШИЛСЯ", async () => {
    const actor = { uuid: "Actor.x1" };
    const order = [];
    let resolveFirst;
    const first = withOriginLock(actor, "homeworld", () => new Promise(res => {
      order.push("first-start");
      resolveFirst = () => { order.push("first-end"); res(); };
    }));
    const second = withOriginLock(actor, "homeworld", () => { order.push("second-start"); return Promise.resolve(); });

    // Второй ещё не должен был стартовать — первый не резолвился.
    await Promise.resolve(); await Promise.resolve();
    expect(order).toEqual(["first-start"]);

    resolveFirst();
    await first; await second;

    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("разные теги на одном акторе не блокируют друг друга", async () => {
    const actor = { uuid: "Actor.x2" };
    const order = [];
    let resolveHw;
    const hw = withOriginLock(actor, "homeworld", () => new Promise(res => {
      order.push("hw-start");
      resolveHw = () => { order.push("hw-end"); res(); };
    }));
    const dv = withOriginLock(actor, "divination", () => { order.push("dv-start"); return Promise.resolve(); });

    await dv; // divination не ждёт homeworld вовсе — разные ключи замка
    expect(order).toEqual(["hw-start", "dv-start"]);

    resolveHw();
    await hw;
  });

  it("падение первого вызова не блокирует очередь навечно — второй всё равно стартует", async () => {
    const actor = { uuid: "Actor.x3" };
    const order = [];
    const first = withOriginLock(actor, "homeworld", () => { order.push("first"); return Promise.reject(new Error("boom")); });
    const second = withOriginLock(actor, "homeworld", () => { order.push("second"); return Promise.resolve("ok"); });

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
    expect(order).toEqual(["first", "second"]);
  });
});
