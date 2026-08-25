// test/documents/fatigue-condition-sync.test.mjs
//
// Тег «Усталость» в блоке СОСТОЯНИЯ (system.conditions.fatigued/-Level)
// должен всегда зеркалить настоящий счётчик Усталости с вкладки ТЕЛО
// (system.fatigue.value) — раньше это были два независимых поля, и кнопки
// +1/−1/Отдых/Сон (module/sheets/tabs/conditions.mjs) правили только
// fatigue.value, оставляя тег стоять на старом значении. Проверяем ДОВОД ДО
// АКТОРА (prepareDerivedData), тот же приём, что и wound-tier-actor.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ fatigueValue = 0, tBonus = 0, wpBonus = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.fatigue.value = fatigueValue;
  system.characteristics.t.bonus  = tBonus;
  system.characteristics.wp.bonus = wpBonus;
  const list = [];
  list.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Усталость: тег СОСТОЯНИЙ зеркалит fatigue.value", () => {
  it("fatigue.value = 0 → тег снят, счётчик 0", () => {
    const s = characterWith({ fatigueValue: 0 });
    expect(s.conditions.fatigued).toBe(false);
    expect(s.conditions.fatiguedLevel).toBe(0);
  });

  it("fatigue.value > 0 → тег активен, счётчик равен значению", () => {
    const s = characterWith({ fatigueValue: 3 });
    expect(s.conditions.fatigued).toBe(true);
    expect(s.conditions.fatiguedLevel).toBe(3);
  });

  it("старое значение тега/счётчика игнорируется — источник истины один", () => {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.fatigue.value = 0;
    system.conditions.fatigued = true;
    system.conditions.fatiguedLevel = 5;
    const list = [];
    list.get = () => null;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
    });
    expect(system.conditions.fatigued).toBe(false);
    expect(system.conditions.fatiguedLevel).toBe(0);
  });
});
