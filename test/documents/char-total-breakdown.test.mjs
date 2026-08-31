// test/documents/char-total-breakdown.test.mjs
//
// Правка по запросу пользователя: прибавки к характеристикам от Архетипов/Рас/
// Субрас/Элитных архетипов/Предсказаний/Происхождений (вкладка МЕХАНИКА item)
// должны идти в ИТОГО, а не в БАЗУ — это уже было так (kind:"characteristic"
// в apps/mechanics.mjs целится только в totalFx/bonusFx, characteristicEffectKey
// не даёт выбрать "base"). Не хватало видимой разборки: тултип на ИТОГО,
// показывающий, из чего сложилось число. char.totalBreakdown — по одной
// строке на именованный вклад (База/Улучшение/Броня/...), а вклад от Механики
// предметов — по каждому предмету-носителю отдельно (characteristicMechContrib),
// а не общей суммой totalFx: игрок должен видеть источник.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

/** Предмет-носитель с embedded ActiveEffect (тот же формат, что mechEffectData
 *  в apps/mechanics.mjs кладёт на предмет: system.changes[]). */
function itemWithCharEffect({ id = "item-1", name = "Предмет", charKey, field = "totalFx", type = "add", value, disabled = false } = {}) {
  const changes = charKey ? [{ key: `system.characteristics.${charKey}.${field}`, type, value }] : [];
  return {
    id, name, type: "trait", system: {},
    getFlag: () => undefined,
    effects: [{ disabled, system: { changes } }]
  };
}

// tTotalFx/tBonusFx — то, что в реальном Foundry Foundry уже applyActiveEffects
// ("initial", ДО prepareDerivedData) успел бы записать в хранимое поле по
// тем же changes, что несёт item.effects; здесь выставляется вручную, тем же
// приёмом, что и в char-bonus-reaches-armor.test.mjs.
function characterWith({ items = [], tTotalFx = 0, tBonusFx = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.t.base = 40;
  system.characteristics.t.totalFx = tTotalFx;
  system.characteristics.t.bonusFx = tBonusFx;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list,
                  getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("разборка Итого характеристики (тултип)", () => {
  it("без надбавок: только строка «База»", () => {
    const system = characterWith();
    expect(system.characteristics.t.totalBreakdown).toEqual([{ label: "База", value: 40 }]);
  });

  it("надбавка Механики предмета (Архетип/Раса/...) идёт в Итого, не в Базу — и видна по имени предмета", () => {
    const system = characterWith({
      items: [itemWithCharEffect({ id: "arc-1", name: "Архетип: Комиссар", charKey: "t", value: 5 })],
      tTotalFx: 5
    });

    // База не тронута — ключевая часть запроса пользователя.
    expect(system.characteristics.t.base).toBe(40);
    expect(system.characteristics.t.total).toBe(45);
    expect(system.characteristics.t.totalBreakdown).toEqual([
      { label: "База", value: 40 },
      { label: "Архетип: Комиссар", value: 5 }
    ]);
  });

  it("несколько предметов — своя строка на каждый источник", () => {
    const system = characterWith({
      items: [
        itemWithCharEffect({ id: "race-1", name: "Раса: Аэльдари", charKey: "t", value: 3 }),
        itemWithCharEffect({ id: "elite-1", name: "Элитный архетип: Ветеран", charKey: "t", value: 2 })
      ],
      tTotalFx: 5
    });

    expect(system.characteristics.t.total).toBe(45);
    expect(system.characteristics.t.totalBreakdown).toEqual([
      { label: "База", value: 40 },
      { label: "Раса: Аэльдари", value: 3 },
      { label: "Элитный архетип: Ветеран", value: 2 }
    ]);
  });

  it("subtract вычитает и попадает в разборку со знаком минус", () => {
    const system = characterWith({
      items: [itemWithCharEffect({ id: "curse-1", name: "Порча", charKey: "t", type: "subtract", value: 5 })],
      tTotalFx: -5
    });

    expect(system.characteristics.t.total).toBe(35);
    expect(system.characteristics.t.totalBreakdown).toEqual([
      { label: "База", value: 40 },
      { label: "Порча", value: -5 }
    ]);
  });

  it("отключённый эффект (disabled) не попадает в разборку", () => {
    const system = characterWith({
      items: [itemWithCharEffect({ id: "off-1", name: "Отключено", charKey: "t", value: 5, disabled: true })]
    });

    expect(system.characteristics.t.total).toBe(40);
    expect(system.characteristics.t.totalBreakdown).toEqual([{ label: "База", value: 40 }]);
  });

  it("эффект на бонус (bonusFx), а не на значение — в разборку Итого не входит", () => {
    const system = characterWith({
      items: [itemWithCharEffect({ id: "bon-1", name: "Сверхъестественное", charKey: "t", field: "bonusFx", value: 5 })],
      tBonusFx: 5
    });

    expect(system.characteristics.t.total).toBe(40);
    expect(system.characteristics.t.bonus).toBe(9); // floor(40/10) + bonusFx 5
    expect(system.characteristics.t.totalBreakdown).toEqual([{ label: "База", value: 40 }]);
  });

  it("именованные модификаторы (Улучшение/Мод.) добавляют свои строки", () => {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.characteristics.t.base = 40;
    system.characteristics.t.improvement = "trained"; // +15
    system.charDamage = { t: 3 };
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([], { get: () => null }), getFlag: () => undefined
    });

    expect(system.characteristics.t.total).toBe(40 + 15 + 3);
    expect(system.characteristics.t.totalBreakdown).toEqual([
      { label: "База", value: 40 },
      { label: "Улучшение (Тренированное)", value: 15 },
      { label: "Мод. (ручной)", value: 3 }
    ]);
  });
});
