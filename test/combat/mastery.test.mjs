// test/combat/mastery.test.mjs
//
// Мастерство, автоуспех за Очко Бесчестия (стр. 62, combat/mastery.mjs): трата
// Очка, карточка с Успехами = Бонус Характеристики, раз на карточку.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { masteryAutoSuccessOnCard, masteryHasPoint } from "../../module/combat/mastery.mjs";

// spendFromInfamyPool читает пул через foundry.utils.getProperty — заглушка
// отдаёт undefined, нужна настоящая реализация по точке-пути.
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

const NS = "warhammer-dbc";
let seq = 0;

function fakeActor({ fate = 3, bonus = 4, mastery = "dodge" } = {}) {
  const updates = [];
  return {
    uuid: "Actor.m1", name: "Мастер", type: "character", isOwner: true,
    items: mastery ? [{ type: "talent", name: "Mastery / Мастерство", system: { aptSource: mastery } }] : [],
    system: { fate: { value: fate, max: 5 }, alignment: "renegade", characteristics: { ag: { bonus } } },
    getFlag: () => undefined,
    async update(u) { updates.push(u); },
    updates
  };
}
const fakeMessage = () => ({
  id: `ms${++seq}`, isOwner: true, flags: {}, speaker: {},
  getFlag(ns, k) { return this.flags[ns]?.[k]; },
  async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; }
});
const card = (extra = {}) => ({ skill: "dodge", char: "ag", label: "Уклонение", success: false, deg: 1, mod: 0, ...extra });

let prev;
beforeEach(() => {
  resetCaptured();
  prev = { socket: game.socket, users: game.users, user: game.user };
  game.socket = { emit() {} };
  game.users = Object.assign([], { activeGM: { id: "gm" } });
  game.user = { id: "u1" };
});
afterEach(() => Object.assign(game, prev));

describe("Мастерство: автоуспех на карточке", () => {
  it("тратит Очко и объявляет Успехи, равные Бонусу Характеристики", async () => {
    const actor = fakeActor({ fate: 3, bonus: 4 });
    const message = fakeMessage();
    expect(await masteryAutoSuccessOnCard(actor, card(), message)).toBe(true);
    expect(actor.updates).toEqual([{ "system.fate.value": 2 }]);
    const html = captured.chat.at(-1)?.content ?? "";
    expect(html).toContain("Успех — 4");
    expect(html).toContain("Уклонение");
    expect(message.flags[NS].masteryAutoSuccessUsed).toBe(true);
  });

  it("раз на карточку: второй клик Очко не тратит", async () => {
    const actor = fakeActor();
    const message = fakeMessage();
    await masteryAutoSuccessOnCard(actor, card(), message);
    expect(await masteryAutoSuccessOnCard(actor, card(), message)).toBe(false);
    expect(actor.updates).toHaveLength(1);
  });

  it("нет Очков — отказ, карточка не помечена", async () => {
    const actor = fakeActor({ fate: 0 });
    const message = fakeMessage();
    expect(masteryHasPoint(actor)).toBe(false);
    expect(await masteryAutoSuccessOnCard(actor, card(), message)).toBe(false);
    expect(actor.updates).toEqual([]);
    expect(message.flags[NS]).toBeUndefined();
  });

  it("поправки хуже +0 — отказ без траты", async () => {
    const actor = fakeActor();
    expect(await masteryAutoSuccessOnCard(actor, card({ mod: -10 }), fakeMessage())).toBe(false);
    expect(actor.updates).toEqual([]);
  });

  it("Навык без Мастерства — отказ без траты", async () => {
    const actor = fakeActor({ mastery: "parry" });
    expect(await masteryAutoSuccessOnCard(actor, card(), fakeMessage())).toBe(false);
    expect(actor.updates).toEqual([]);
  });
});
