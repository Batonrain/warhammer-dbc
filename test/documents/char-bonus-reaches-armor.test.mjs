// test/documents/char-bonus-reaches-armor.test.mjs
//
// Отчёт игроков (wdbc-gak, симптом 3): бонус T.b от «вшитой» механики доходит
// до брони, а тот же бонус через Конструктор — нет.
//
// Причина в фазах. char.bonus СЧИТАЕТСЯ в prepareDerivedData из total/10 +
// supernatural + вшитые надбавки, а поглощение берёт готовый T.b несколькими
// строками ниже. ActiveEffect фазы "final" ложится ПОСЛЕ всего расчёта: число
// на листе меняется, а до брони, навыков и перемещений не доходит.
//
// Поэтому цель у эффекта — ХРАНИМОЕ поле bonusFx, а фаза "initial": тем же
// приёмом работают system.armorBonus и system.encumbrance.indexBonus.
//
// Расчёт листа стендом не покрыт (AGENTS.md), но prepareDerivedData оказался
// вызываемым без живого документа Foundry: ему хватает system из схемы и
// коллекции предметов. Здесь он и вызывается — иначе проверять фазу пришлось
// бы по ключу в отрыве от того, доходит ли число до брони.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Предмет на акторе: ровно то, что читает цикл надбавок в prepareDerivedData. */
function itemFor({ type = "trait", name = "Черта", system = {}, flags = {} } = {}) {
  return { id: `${type}-1`, name, type, system, getFlag: (_s, k) => flags[k] };
}

/** Персонаж с готовой схемой: Стойкость 40 (T.b 4), без брони. */
function characterWith({ items = [], ...patch } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.t.base = 40;
  Object.assign(system, patch);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list,
                  getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("бонус характеристики доходит до производных", () => {
  it("без надбавок: T 40 → T.b 4, поглощение тела 4", () => {
    const system = characterWith();

    expect(system.characteristics.t.bonus).toBe(4);
    expect(system.absorption.body).toBe(4);
  });

  // «Вшитая» дорожка — старое поле system.effects у Черты. Работала всегда:
  // складывается ДО расчёта Бонуса, поэтому доходит до брони. Тест держит её,
  // пока она жива: именно с ней игроки сравнивали Конструктор.
  it("старое поле Черты доходит до брони", () => {
    const system = characterWith({
      items: [itemFor({ system: { effects: { charBonusStat: "t", charBonusValue: 2 } } })]
    });

    expect(system.characteristics.t.bonus).toBe(6);
    expect(system.absorption.body).toBe(6);
  });

  // То же число, но пришедшее эффектом (Конструктор или миграция легаси).
  // Foundry применяет фазу "initial" ДО prepareDerivedData, поэтому в тесте
  // хранимое поле просто заполнено — как оно и будет выглядеть в расчёте.
  it("надбавка от эффекта доходит до брони так же", () => {
    const system = characterWith({ items: [] });
    const withFx = characterWith({});
    withFx.characteristics.t.bonusFx = 2;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system: withFx,
      items: Object.assign([], { get: () => null }), getFlag: () => undefined
    });

    expect(system.absorption.body).toBe(4);        // контроль: без надбавки
    expect(withFx.characteristics.t.bonus).toBe(6);
    expect(withFx.absorption.body).toBe(6);
  });

  it("надбавка складывается со старым полем, а не вытесняет его", () => {
    const system = characterWith({
      items: [itemFor({ system: { effects: { charBonusStat: "t", charBonusValue: 2 } } })]
    });
    system.characteristics.t.bonusFx = 1;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([itemFor({ system: { effects: { charBonusStat: "t", charBonusValue: 2 } } })],
                           { get: () => null }),
      getFlag: () => undefined
    });

    expect(system.characteristics.t.bonus).toBe(7);
    expect(system.absorption.body).toBe(7);
  });
});

// wdbc-o9c — тот же разрыв фаз, только полем правее. Навыки считаются из
// chars[def.char].total внутри prepareDerivedData, поэтому эффект фазы "final"
// на .total поднимал показанное Значение, а Навыки от него — нет. Цель та же:
// хранимое totalFx, которое входит в сам расчёт раньше строки Навыков.
describe("надбавка к ЗНАЧЕНИЮ доходит до навыков", () => {
  /** Любой навык от Силы — какой именно, тесту всё равно. */
  const STRENGTH_SKILL = Object.keys(SKILLS_DEF).find(k => SKILLS_DEF[k].char === "s");

  it("totalFx поднимает навык на ту же величину", () => {
    const base   = characterWith();
    const withFx = characterWith();
    withFx.characteristics.s.totalFx = 10;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system: withFx,
      items: Object.assign([], { get: () => null }), getFlag: () => undefined
    });

    expect(withFx.characteristics.s.total - base.characteristics.s.total).toBe(10);
    expect(withFx.skills[STRENGTH_SKILL].total - base.skills[STRENGTH_SKILL].total).toBe(10);
  });
});
