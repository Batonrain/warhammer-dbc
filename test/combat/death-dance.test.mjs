// test/combat/death-dance.test.mjs
//
// module/combat/death-dance.mjs (wdbc-sk8s) — счётчик использований за бой
// и эскалирующая цена. Сама выдача бонуса живёт в attack-dialog.mjs (UI,
// не тестируется отдельным юнит-тестом — слишком тяжёлый диалоговый пайплайн,
// см. соглашение проекта по attack.mjs/damage.mjs), здесь — только примитив.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { hasDeathDance, deathDanceUsedCount, deathDanceNextCost, markDeathDanceUsed }
  from "../../module/combat/death-dance.mjs";

function actorWithTalent(hasTalent) {
  const flags = {};
  return {
    items: hasTalent ? [{ type: "talent", name: "Death Dance / Смертельный Танец" }] : [],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("hasDeathDance", () => {
  it("определяет владение по имени Таланта", () => {
    expect(hasDeathDance(actorWithTalent(true))).toBe(true);
    expect(hasDeathDance(actorWithTalent(false))).toBe(false);
    expect(hasDeathDance(null)).toBe(false);
  });
});

describe("deathDanceUsedCount / deathDanceNextCost / markDeathDanceUsed", () => {
  it("первое использование в бою — бесплатно (cost 0)", () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = actorWithTalent(true);
    expect(deathDanceUsedCount(actor)).toBe(0);
    expect(deathDanceNextCost(actor)).toBe(0);
  });

  it("цена растёт на 1 очко судьбы за каждое следующее использование", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = actorWithTalent(true);

    await markDeathDanceUsed(actor); // 1-е — бесплатное
    expect(deathDanceNextCost(actor)).toBe(1); // 2-е стоит 1

    await markDeathDanceUsed(actor); // 2-е — за 1 ОС
    expect(deathDanceNextCost(actor)).toBe(2); // 3-е стоит 2

    await markDeathDanceUsed(actor);
    expect(deathDanceNextCost(actor)).toBe(3); // 4-е стоит 3
  });

  it("новый бой сбрасывает счётчик — снова бесплатно", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = actorWithTalent(true);
    await markDeathDanceUsed(actor);
    await markDeathDanceUsed(actor);
    expect(deathDanceNextCost(actor)).toBe(2);

    globalThis.game.combat = { id: "combat-2" };
    expect(deathDanceUsedCount(actor)).toBe(0);
    expect(deathDanceNextCost(actor)).toBe(0);
  });

  it("нет предела использований — счётчик копится сколько угодно", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = actorWithTalent(true);
    for (let i = 0; i < 10; i++) await markDeathDanceUsed(actor);
    expect(deathDanceUsedCount(actor)).toBe(10);
    expect(deathDanceNextCost(actor)).toBe(10);
  });
});
