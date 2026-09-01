// test/documents/dreadnought-sarcophagus-char-delta.test.mjs
//
// Саркофаг Дредноута (wdbc-drn, стр. 57): рейтинги Unnatural S/T снижаются
// расчётом листа (module/rules/dreadnought.mjs::sarcophagusCharDelta), а не
// плоским модификатором — уже есть чистый тест самой функции в
// test/rules/sarcophagus.test.mjs, здесь проверяется, что character.mjs
// действительно её вызывает и только для пилота.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { DREADNOUGHT_PILOT_FLAG } from "../../module/rules/dreadnought.mjs";

const unnaturalItem = (stat, value) => ({
  id: `u-${stat}`, name: "Тестовый источник Unnatural", type: "trait",
  system: { effects: { charBonuses: [{ stat, value }] } },
  getFlag: () => undefined, effects: []
});

function characterWith({ items = [], pilot = false } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.s.base = 30;
  system.characteristics.t.base = 30;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", uuid: "Actor.pilot1", name: "Подставной",
                   system, items: list, getFlag: () => undefined };
  if (pilot) {
    registerRuleSource("test.pilot", () => [
      { id: "test.pilot", when: {}, effects: [{ kind: "grantFlag", target: DREADNOUGHT_PILOT_FLAG }] }
    ]);
  }
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Саркофаг Дредноута: Unnatural S/T/W на листе (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("не пилот — рейтинги Сверхъестественного не трогаются", () => {
    clearRuleSources();
    const system = characterWith({ items: [unnaturalItem("s", 6), unnaturalItem("t", 5)], pilot: false });
    expect(system.traitCharBonus.s).toBe(6);
    expect(system.traitCharBonus.t).toBe(5);
    expect(system.traitCharBonus.wp || 0).toBe(0);
  });

  it("пилот с рейтингом выше среза — снижается ровно на срез книги, W растёт на 4", () => {
    clearRuleSources();
    const system = characterWith({ items: [unnaturalItem("s", 6), unnaturalItem("t", 5)], pilot: true });
    expect(system.traitCharBonus.s).toBe(2);  // 6 − 4 (Unnatural S)
    expect(system.traitCharBonus.t).toBe(3);  // 5 − 2 (Unnatural T)
    expect(system.traitCharBonus.wp).toBe(4); // Unnatural W +4
  });

  it("пилот без своего рейтинга — срез не уводит ниже нуля, Unnatural W всё равно +4", () => {
    clearRuleSources();
    const system = characterWith({ items: [], pilot: true });
    expect(system.traitCharBonus.s).toBe(0);
    expect(system.traitCharBonus.t).toBe(0);
    expect(system.traitCharBonus.wp).toBe(4);
  });
});
