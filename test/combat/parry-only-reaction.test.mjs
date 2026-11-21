// test/combat/parry-only-reaction.test.mjs
//
// Книга Битвы (Виткис; Sahara 586-961c): «+1 Реакция, которую можно потратить только на Парирование атак
// цели» — раньше шла в общий пул Реакций на Избегание (defenseValue) и годилась на любое Уклонение/Парирование
// от кого угодно. Теперь — отдельная метка parryOnlyReaction с целями, до начала следующего своего Хода.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  canSpendReaction, spendReaction, PARRY_ONLY_REACTION_FLAG
} from "../../module/combat/action-economy.mjs";
import { bookParryReactionFlag } from "../../module/rules/vitkis-talents.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

function actorFor({ value = 0 } = {}) {
  const store = {};
  const doc = {
    name: "Виткис", type: "character", uuid: "Actor.v",
    system: { actionPoints: { value: 2, max: 2 }, reactions: { value, max: 1, defenseValue: 0, defenseMax: 0 } }
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, v) => { store[`${scope}.${key}`] = v; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  doc.update = async (changes = {}) => {
    for (const [path, v] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = v;
    }
  };
  return doc;
}
const target = { uuid: "Actor.t", id: "t" };
const stranger = { uuid: "Actor.s", id: "s" };

beforeEach(() => { globalThis.game.combat = { started: true }; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("Книга Битвы: Реакция только на Парирование атак цели", () => {
  it("метка из записей Провидца Войны: цели только с book", () => {
    const flag = bookParryReactionFlag([
      { targetUuid: "Actor.t", targetId: "t", effect: "dmg", book: true },
      { targetUuid: "Actor.x", targetId: "x", effect: "evade", book: false }
    ]);
    expect(flag).toEqual({ value: 1, targets: [{ targetUuid: "Actor.t", targetId: "t" }] });
    expect(bookParryReactionFlag([{ targetUuid: "Actor.x", effect: "evade" }])).toBeNull();
  });

  it("Парирование атаки цели — проходит без общей Реакции и тратит метку", async () => {
    const a = actorFor({ value: 0 });
    await a.setFlag("warhammer-dbc", PARRY_ONLY_REACTION_FLAG, bookParryReactionFlag([{ targetUuid: "Actor.t", targetId: "t", book: true }]));
    expect(canSpendReaction(a, { forDefense: true, parryAgainst: target })).toBe(true);
    expect(await spendReaction(a, { forDefense: true, parryAgainst: target })).toBe(true);
    expect(a.getFlag("warhammer-dbc", PARRY_ONLY_REACTION_FLAG)?.value ?? 0).toBe(0);
    expect(canSpendReaction(a, { forDefense: true, parryAgainst: target })).toBe(false);
  });

  it("Парирование чужой атаки и Уклонение от цели метку не тратят", async () => {
    const a = actorFor({ value: 0 });
    await a.setFlag("warhammer-dbc", PARRY_ONLY_REACTION_FLAG, { value: 1, targets: [{ targetUuid: "Actor.t", targetId: "t" }] });
    expect(canSpendReaction(a, { forDefense: true, parryAgainst: stranger })).toBe(false);
    expect(canSpendReaction(a, { forDefense: true })).toBe(false);
  });

  it("есть и общая Реакция — сперва тратится метка Книги Битвы", async () => {
    const a = actorFor({ value: 1 });
    await a.setFlag("warhammer-dbc", PARRY_ONLY_REACTION_FLAG, { value: 1, targets: [{ targetUuid: "Actor.t", targetId: "t" }] });
    await spendReaction(a, { forDefense: true, parryAgainst: target });
    expect(a.system.reactions.value).toBe(1);
  });

  it("метка живёт до начала следующего своего Хода", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(PARRY_ONLY_REACTION_FLAG);
  });
});
