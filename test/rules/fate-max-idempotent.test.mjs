// test/rules/fate-max-idempotent.test.mjs
//
// wdbc-zzz2: system.fate.max у не-друкхари нигде не пишется формулой — целиком
// приходит ActiveEffect'ом Конструктора (kind:"poolMax", final-фаза).
// Actor#applyActiveEffects (Foundry) складывает "текущее значение + прибавка"
// поверх того, что уже лежит в system.fate.max на момент финальной фазы, а не
// поверх _source. Без явного сброса в prepareDerivedData повторный
// prepareData() без полной пересборки actor._initialize() копил бы бонус на
// каждый проход. character.mjs теперь сбрасывает fate.max к 0 на каждом
// прогоне (симметрично формуле друкхари чуть выше по файлу) — эти тесты
// проверяют именно сброс, а не саму работу Foundry ActiveEffect (стенд
// foundry-stub.mjs их не эмулирует).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ race = "", fateMax = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.race = race;
  system.fate.max = fateMax;
  const list = [];
  list.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("fate.max не копится между прогонами (wdbc-zzz2)", () => {
  it("не-друкхари: унаследованное из прошлого прогона значение сбрасывается к 0", () => {
    expect(characterWith({ fateMax: 3 }).fate.max).toBe(0);
  });

  it("друкхари: формула W.b×(1+Бездонная Душа) не задета фиксом", () => {
    expect(characterWith({ race: "drukhari", fateMax: 99 }).fate.max).toBe(0);
  });

  it("симуляция двух подряд prepareData() с final-эффектом между ними не копит бонус", () => {
    // Каждый вызов prepareDerivedData имитирует один проход Foundry ДО того,
    // как applyActiveEffects("final") прибавит +1 от расовой Черты.
    let system = characterWith({ fateMax: 0 });
    system.fate.max += 1; // как будто отработал final-эффект kind:"poolMax" +1

    const list = [];
    list.get = () => null;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
    });
    system.fate.max += 1; // final-эффект отработал ещё раз на том же экземпляре

    expect(system.fate.max).toBe(1);
  });
});
