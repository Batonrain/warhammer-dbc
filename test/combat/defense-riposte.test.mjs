// test/combat/defense-riposte.test.mjs
//
// Рипост / Riposte (Таланты «Рукопашные», Sahara 3-8dc5): успешно парировав двумя
// оружиями, персонаж может тут же ударить ДРУГИМ оружием (Баланс ≥ 0). Здесь —
// кнопка в карточке Парирования (combat/defense.mjs); логика отбора оружия —
// test/rules/melee-talents.test.mjs, штраф Избегания цели — sheets/attack/selection.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();
const RIPOSTE = "meleeCore.core.riposte";

function melee({ id, name, balance = 0 }) {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", balance, equipped: true, hands: 1 }, { id, name });
  w.type = "weapon";
  return w;
}

function hero(items, ...caps) {
  clearRuleSources();
  registerRuleSource("test", () => caps.map(c => ({
    id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
  })));
  const a = actorFor({ items });
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return a;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];                  // Парирование удалось
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

async function parry(actor) {
  await _performParry(actor, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
  return captured.chat.at(-1).content;
}

describe("Рипост: кнопка в карточке успешного Парирования", () => {
  it("два меча и Талант: кнопка называет ДРУГОЕ оружие и штраф Избегания", async () => {
    const main = melee({ id: "w1", name: "Клинок" });
    const off  = melee({ id: "w2", name: "Кинжал" });
    const card = await parry(hero([main, off], RIPOSTE));
    expect(card).toContain("wh-riposte-btn");
    expect(card).toMatch(/wh-riposte-btn[^>]*data-weapon-id="w2"|data-weapon-id="w2"[^>]*>\s*[^<]*Рипост/);
    expect(card).toContain("Избегание цели −20");
  });

  it("без Таланта кнопки нет", async () => {
    const card = await parry(hero([melee({ id: "w1", name: "Клинок" }), melee({ id: "w2", name: "Кинжал" })]));
    expect(card).not.toContain("wh-riposte-btn");
  });

  it("одно оружие — не «вооружён двумя»: кнопки нет", async () => {
    const card = await parry(hero([melee({ id: "w1", name: "Клинок" })], RIPOSTE));
    expect(card).not.toContain("wh-riposte-btn");
  });

  it("второе оружие с Балансом −1 не годится", async () => {
    const card = await parry(hero([melee({ id: "w1", name: "Клинок" }), melee({ id: "w2", name: "Топор", balance: -1 })], RIPOSTE));
    expect(card).not.toContain("wh-riposte-btn");
  });

  it("проваленное Парирование — Рипоста нет", async () => {
    captured.dice = [99];
    const card = await parry(hero([melee({ id: "w1", name: "Клинок" }), melee({ id: "w2", name: "Кинжал" })], RIPOSTE));
    expect(card).not.toContain("wh-riposte-btn");
  });
});
