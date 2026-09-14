// test/combat/purity-of-battle.test.mjs
//
// Purity of Battle / Чистота Битвы (Дар Кхорна, wdbc-1rno): волна снимает
// боевые наркотики и психосилы (свои и чужие, нацеленные на жертву) со всех
// в радиусе. Техночудеса — честно не тронуты (isSustained у них нет вообще).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { purgeBattleBuffsFrom, purityOfBattleWave } from "../../module/combat/purity-of-battle.mjs";

function itemsOf(list) {
  const arr = list.slice();
  arr.contents = arr;
  return arr;
}

function mockActor(name, items) {
  const actor = {
    name, type: "character",
    items: itemsOf(items.map(i => ({ ...i }))),
    updateEmbeddedDocuments: async (docType, patches) => {
      for (const patch of patches) {
        const item = actor.items.find(i => i.id === patch._id);
        if (!item) continue;
        for (const [dotted, value] of Object.entries(patch)) {
          if (dotted === "_id") continue;
          const parts = dotted.split(".");
          let obj = item;
          for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] ??= {};
          obj[parts.at(-1)] = value;
        }
      }
    }
  };
  actor.uuid = `Actor.${name}`;
  return actor;
}

function drugItem(id, active) {
  return { id, type: "drug", name: `Наркотик ${id}`, system: { activeEffect: { isActive: active } } };
}
function powerItem(id, { sustained = false, targetUuid = "" } = {}) {
  return { id, type: "psychicPower", name: `Сила ${id}`, system: { isSustained: sustained, sustainedTargetUuid: targetUuid, sustainedDegree: sustained ? 2 : null } };
}

describe("purgeBattleBuffsFrom — один персонаж", () => {
  beforeEach(() => { globalThis.game = { actors: [] }; });
  afterEach(() => { delete globalThis.game; });

  it("снимает свой активный боевой наркотик", async () => {
    const actor = mockActor("Жертва", [drugItem("d1", true), drugItem("d2", false)]);
    const summary = await purgeBattleBuffsFrom(actor);
    expect(summary.drugs).toEqual(["Наркотик d1"]);
    expect(actor.items.find(i => i.id === "d1").system.activeEffect.isActive).toBe(false);
    expect(actor.items.find(i => i.id === "d2").system.activeEffect.isActive).toBe(false); // уже был снят, не трогаем счётчик
  });

  it("снимает своё поддержание своей же психосилы", async () => {
    const actor = mockActor("Псайкер", [powerItem("p1", { sustained: true })]);
    const summary = await purgeBattleBuffsFrom(actor);
    expect(summary.powers).toEqual(["Сила p1"]);
    const item = actor.items.find(i => i.id === "p1");
    expect(item.system.isSustained).toBe(false);
    expect(item.system.sustainedDegree).toBe(null);
  });

  it("снимает ЧУЖУЮ психосилу, чья текущая цель — этот актор", async () => {
    const victim = mockActor("Жертва", []);
    const caster = mockActor("Псайкер", [powerItem("p1", { sustained: true, targetUuid: victim.uuid })]);
    globalThis.game.actors = [victim, caster];
    const summary = await purgeBattleBuffsFrom(victim);
    expect(summary.powers).toEqual(["Сила p1"]);
    const item = caster.items.find(i => i.id === "p1");
    expect(item.system.isSustained).toBe(false);
    expect(item.system.sustainedTargetUuid).toBe("");
  });

  it("чужая психосила, нацеленная на КОГО-ТО ДРУГОГО, не трогается", async () => {
    const victim = mockActor("Жертва", []);
    const other = mockActor("Другой", []);
    const caster = mockActor("Псайкер", [powerItem("p1", { sustained: true, targetUuid: other.uuid })]);
    globalThis.game.actors = [victim, other, caster];
    const summary = await purgeBattleBuffsFrom(victim);
    expect(summary.powers).toEqual([]);
    expect(caster.items.find(i => i.id === "p1").system.isSustained).toBe(true);
  });

  it("ничего активного — пустая сводка, без ошибок", async () => {
    const actor = mockActor("Чистый", [drugItem("d1", false)]);
    const summary = await purgeBattleBuffsFrom(actor);
    expect(summary.drugs).toEqual([]);
    expect(summary.powers).toEqual([]);
  });
});

describe("purityOfBattleWave — вся сцена разом", () => {
  beforeEach(() => { globalThis.game = { actors: [] }; });
  afterEach(() => { delete globalThis.game; });

  function tokenOf(actor, x, y) {
    return { id: actor.name, hidden: false, actor, x, y, width: 1, height: 1 };
  }

  it("снимает наркотики со всех токенов в радиусе, включая кастера", async () => {
    const caster = mockActor("Кастер", [drugItem("d1", true)]);
    const near = mockActor("Рядом", [drugItem("d2", true)]);
    const far = mockActor("Далеко", [drugItem("d3", true)]);
    const casterToken = tokenOf(caster, 0, 0);
    const nearToken = tokenOf(near, 0, 0);
    const farToken = tokenOf(far, 0, 0);
    const grid = { size: 100, distance: 1, type: 0 };
    // «далеко» — в отдельной клетке подальше, считает tokenDocDistance по x/y
    farToken.x = 1000; farToken.y = 1000;
    const tokens = [casterToken, nearToken, farToken];
    casterToken.parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid };
    for (const t of tokens) t.parent = casterToken.parent;

    const summaries = await purityOfBattleWave(casterToken, 5);
    const names = summaries.map(s => s.name).sort();
    expect(names).toEqual(["Кастер", "Рядом"]);
    expect(caster.items.find(i => i.id === "d1").system.activeEffect.isActive).toBe(false);
    expect(near.items.find(i => i.id === "d2").system.activeEffect.isActive).toBe(false);
    expect(far.items.find(i => i.id === "d3").system.activeEffect.isActive).toBe(true);
  });
});
