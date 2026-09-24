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

function characterWith({ fatigueValue = 0, tBonus = 0, wpBonus = 0, gangrene = false } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.fatigue.value = fatigueValue;
  system.characteristics.t.bonus  = tBonus;
  system.characteristics.wp.bonus = wpBonus;
  system.conditions.gangrene = gangrene;
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

// Гангрена («Статусы», wdbc-x1nz.2.96): «получает 1 Усталости, которую нельзя
// снять, пока не вылечена Гангрена» — +1 ПОВЕРХ хранимой, не пол. Прежние
// тесты закрепляли пол Math.max(1, value) (Усталость 3 с Гангреной
// оставалась 3) — исправлены под книгу: действующая 4. Хранимое
// fatigue.value не трогается, иначе надбавка запеклась бы в него при первой
// записи Усталости (отдых, препарат); действующее — fatigue.effective.
describe("Гангрена: +1 неснимаемая Усталость поверх хранимой", () => {
  it("Гангрена стоит, fatigue.value=0 — действующая 1, хранимое 0", () => {
    const s = characterWith({ fatigueValue: 0, gangrene: true });
    expect(s.fatigue.value).toBe(0);
    expect(s.fatigue.effective).toBe(1);
    expect(s.conditions.fatigued).toBe(true);
    expect(s.conditions.fatiguedLevel).toBe(1);
  });

  it("Гангрена стоит, fatigue.value=3 — действующая 4 (+1, а не пол)", () => {
    const s = characterWith({ fatigueValue: 3, gangrene: true });
    expect(s.fatigue.value).toBe(3);
    expect(s.fatigue.effective).toBe(4);
    expect(s.conditions.fatiguedLevel).toBe(4);
  });

  it("нет Гангрены — действующая равна хранимой", () => {
    const s = characterWith({ fatigueValue: 0, gangrene: false });
    expect(s.fatigue.value).toBe(0);
    expect(s.fatigue.effective).toBe(0);
    expect(s.conditions.fatigued).toBe(false);
  });
});

// Без сознания (стр. 30-31, wdbc-r5o7.7): «Считается Беспомощным» — тем же
// приёмом, что тег Усталости выше, а не ручным дублированием двух флагов у
// каждого писателя (было — только sheets/tabs/death.mjs, остальные места
// вроде addFatigue-порога Беспомощность не ставили вовсе).
describe("Без сознания ⇒ Беспомощен (производное поле)", () => {
  it("unconscious:true — helpless становится true, даже если не был выставлен", () => {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.conditions.unconscious = true;
    system.conditions.helpless = false;
    const list = [];
    list.get = () => null;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
    });
    expect(system.conditions.helpless).toBe(true);
  });

  it("unconscious:false, helpless выставлен отдельно (напр. схвачен) — не трогается", () => {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.conditions.unconscious = false;
    system.conditions.helpless = true;
    const list = [];
    list.get = () => null;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
    });
    expect(system.conditions.helpless).toBe(true);
  });

  it("ни то ни другое — helpless остаётся false", () => {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    const list = [];
    list.get = () => null;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
    });
    expect(system.conditions.helpless).toBe(false);
  });
});
