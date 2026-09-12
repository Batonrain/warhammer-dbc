// test/documents/rules-cache-mid-pass.test.mjs
//
// wdbc-2gn (находка 1 ревью 07.09.2026): rules/character.mjs:413 задаёт ПЕРВЫЙ
// за пересчёт вопрос кэшу правил (hasRuleFlag(actor, DREADNOUGHT_PILOT_FLAG))
// ДО цикла характеристик (473-503 на момент находки) и ДО
// Object.assign(system.conditions, readAllMirrors(actor)). Правило, гейтящееся
// charBonusMin/hasCondition (rules/predicates.mjs — читают bonus/conditions
// прямо с живого actor.system), на этом первом вопросе отбирается по ещё не
// обновлённым данным, и весь остаток пересчёта (в т.ч. более поздние вопросы
// того же имени, что и здесь — hasRuleFlag(DREADNOUGHT_PILOT_FLAG) на
// wounds.effectiveMax) обслуживается тем же кэшем.
//
// Тест воспроизводит это НА РЕАЛЬНОМ прохождении prepareCharacterDerived, а не
// на голом collect.mjs (см. test/rules/rules-cache.test.mjs — тот проверяет
// сам примитив invalidateRulesCacheFor): регистрируется временный источник,
// который выдаёт САМ DREADNOUGHT_PILOT_FLAG, но гейтит его hasCondition:
// ["inRage"] — Метка «в Ярости», которая появляется в system.conditions
// только после readAllMirrors, то есть ПОЗЖЕ первого вопроса. Наблюдаемый
// эффект — system.wounds.effectiveMax (Саркофаг Дредноута: max − 5, стр. 57):
// если флаг остаётся «примороженным» к состоянию до Ярости, эффективный
// максимум Ран останется обычным (без −5), хотя актор во время ЭТОГО ЖЕ
// пересчёта уже «в Ярости».

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { DREADNOUGHT_PILOT_FLAG, SARCOPHAGUS } from "../../module/rules/dreadnought.mjs";

const DEFAULT_SOURCES = getRuleSources();
const restore = () => {
  clearRuleSources();
  for (const [k, fn] of DEFAULT_SOURCES) registerRuleSource(k, fn);
};

beforeEach(() => {
  clearRuleSources();
  for (const [k, fn] of DEFAULT_SOURCES) registerRuleSource(k, fn);
  // Источник-подсадка: та же возможность, что «Пилот Дредноута», но выдаётся
  // не связью с Дредноутом, а Меткой «в Ярости» — единственная цель подмены
  // в том, чтобы условие правила зависело от system.conditions, а не от
  // game.actors (которого в юнит-тестах нет).
  registerRuleSource("test.rageGrantsDreadnoughtFlag", () => [{
    id: "test.rage-dreadnought", when: { hasCondition: ["inRage"] },
    effects: [{ kind: "grantFlag", target: DREADNOUGHT_PILOT_FLAG }]
  }]);
});
afterEach(restore);

function characterWith({ inRage = false, woundsMax = 20 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.inRage = inRage;
  system.wounds.max = woundsMax;
  const list = [];
  list.get = () => null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("кэш правил не примораживает состояние ДО readAllMirrors (wdbc-2gn)", () => {
  it("не в Ярости: обычный максимум Ран, флаг не сработал", () => {
    const system = characterWith({ inRage: false, woundsMax: 20 });
    expect(system.conditions.inRage).toBe(false);
    expect(system.wounds.effectiveMax).toBe(20);
  });

  it("в Ярости: Метка появляется В ЭТОМ ЖЕ проходе, и завязанный на неё флаг обязан её увидеть", () => {
    const system = characterWith({ inRage: true, woundsMax: 20 });
    // Условие правила — по conditions.inRage, который сам этим же проходом
    // мирруется из system.inRage (readAllMirrors). Если бы кэш собрался ДО
    // мирроринга и не сбрасывался, флаг остался бы не выданным до СЛЕДУЮЩЕГО
    // пересчёта — а значение ниже осталось бы 20 вместо 15.
    expect(system.conditions.inRage).toBe(true);
    expect(system.wounds.effectiveMax).toBe(Math.max(0, 20 + SARCOPHAGUS.woundsMax));
  });
});
