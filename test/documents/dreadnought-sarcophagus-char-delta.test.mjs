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

function characterWith({ items = [], pilot = false, wpBase = 0, woundsMax = null, interred = false } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.s.base = 30;
  system.characteristics.t.base = 30;
  system.characteristics.wp.base = wpBase;
  if (woundsMax !== null) system.wounds.max = woundsMax;
  system.sarcophagusInterred = interred;
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

describe("Саркофаг Дредноута: максимум Ран −5 на листе (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("не пилот — effectiveMax равен обычному max", () => {
    clearRuleSources();
    const system = characterWith({ pilot: false, woundsMax: 25 });
    expect(system.wounds.effectiveMax).toBe(25);
  });

  it("пилот — effectiveMax на 5 меньше max, сам max не тронут", () => {
    clearRuleSources();
    const system = characterWith({ pilot: true, woundsMax: 25 });
    expect(system.wounds.effectiveMax).toBe(20);
    expect(system.wounds.max).toBe(25);
  });

  it("пилот с max меньше 5 — effectiveMax не уходит в минус", () => {
    clearRuleSources();
    const system = characterWith({ pilot: true, woundsMax: 3 });
    expect(system.wounds.effectiveMax).toBe(0);
  });
});

describe("Саркофаг Дредноута: аблативные Раны против варп-оружия на листе (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("не пилот — максимум 0", () => {
    clearRuleSources();
    const system = characterWith({ pilot: false, wpBase: 40 });
    expect(system.sarcophagusWarpWounds.max).toBe(0);
  });

  it("пилот — максимум равен W.b (уже включая Unnatural W +4 самого же Саркофага)", () => {
    clearRuleSources();
    // wp.base 40 → базовый W.b 4, плюс Unnatural W +4 (тот же Саркофаг,
    // см. блок «Unnatural S/T/W» выше) → эффективный W.b 8.
    const system = characterWith({ pilot: true, wpBase: 40 });
    expect(system.sarcophagusWarpWounds.max).toBe(8);
  });

  it("сохранённое значение клампится к новому максимуму", () => {
    clearRuleSources();
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.characteristics.wp.base = 20; // W.b 2, + Unnatural W +4 = 6
    system.sarcophagusWarpWounds.value = 10;
    const list = [];
    list.get = () => null;
    const actor = { type: "character", uuid: "Actor.pilot1", name: "Подставной",
                     system, items: list, getFlag: () => undefined };
    registerRuleSource("test.pilot", () => [
      { id: "test.pilot", when: {}, effects: [{ kind: "grantFlag", target: DREADNOUGHT_PILOT_FLAG }] }
    ]);
    WarhammerActor.prototype.prepareDerivedData.call(actor);
    expect(system.sarcophagusWarpWounds.max).toBe(6);
    expect(system.sarcophagusWarpWounds.value).toBe(6);
  });
});

describe("Саркофаг Дредноута: sarcophagusHelplessNow на листе (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("не вживлён — флаг не поднимается независимо от подключения", () => {
    clearRuleSources();
    expect(characterWith({ pilot: false, interred: false }).sarcophagusHelplessNow).toBe(false);
    clearRuleSources();
    expect(characterWith({ pilot: true, interred: false }).sarcophagusHelplessNow).toBe(false);
  });

  it("вживлён и подключён — не форсируется", () => {
    clearRuleSources();
    expect(characterWith({ pilot: true, interred: true }).sarcophagusHelplessNow).toBe(false);
  });

  it("вживлён и НЕ подключён — форсируется", () => {
    clearRuleSources();
    expect(characterWith({ pilot: false, interred: true }).sarcophagusHelplessNow).toBe(true);
  });
});
