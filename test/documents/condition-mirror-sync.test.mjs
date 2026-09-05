// test/documents/condition-mirror-sync.test.mjs
//
// Метки актора (wdbc-5uae) в блоке СОСТОЯНИЯ: «в Ярости», «в Беге»,
// «отмечен» и т.п. должны появляться в system.conditions на каждом пересчёте,
// оставаясь храниться там, где хранились всегда (system.inRage, флаги актора,
// флаг на щите). Тот же приём и тот же способ проверки, что у тега «Усталость»
// (fatigue-condition-sync.test.mjs) — доведение ДО АКТОРА, через
// prepareDerivedData, а не вызов чистой функции: важно, что метка доезжает до
// того самого места, откуда её берут лист, токен и предикат hasCondition.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { CONDITION_MARK_KEYS } from "../../module/constants/conditions.mjs";

const FLAG = "warhammer-dbc";

function characterWith({ system: over = {}, flags = {}, items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  Object.assign(system, over);
  const list = [...items];
  list.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list,
    getFlag: (scope, key) => (scope === FLAG ? flags[key] : undefined)
  });
  return system;
}

/** Предмет-щит: минимум полей, который переживает общий пересчёт листа. */
const itemWithFlag = (key, value) => ({
  id: "shield-1", name: "Щит", type: "armor",
  system: { weight: 0, quantity: 1, equipped: true },
  effects: [],
  getFlag: (scope, k) => (scope === FLAG && k === key ? value : undefined)
});

describe("метки доезжают до system.conditions", () => {
  it("Ярость из своего поля схемы", () => {
    expect(characterWith({ system: { inRage: true } }).conditions.inRage).toBe(true);
    expect(characterWith({ system: { inRage: false } }).conditions.inRage).toBe(false);
  });

  it("Бег и Выход из Боя — из флагов актора", () => {
    const s = characterWith({ flags: { running: true, disengageActive: true } });
    expect(s.conditions.running).toBe(true);
    expect(s.conditions.disengaging).toBe(true);
  });

  it("Отмечен — от любой из трёх чужих меток", () => {
    const s = characterWith({ flags: { avatarOfSlaughterMark: { berserkerUuid: "a" } } });
    expect(s.conditions.marked).toBe(true);
  });

  it("Щит поднят — из флага на предмете, но виден на акторе", () => {
    const s = characterWith({ items: [itemWithFlag("shieldRaised", true)] });
    expect(s.conditions.shieldUp).toBe(true);
  });

  it("пустой актор — ни одной метки, и ничего не падает", () => {
    const s = characterWith();
    for (const key of CONDITION_MARK_KEYS) expect(s.conditions[key]).toBe(false);
  });
});

describe("источник истины один — как у тега «Усталость»", () => {
  it("старое значение в conditions игнорируется, пересчитывается из источника", () => {
    // Метка снята с актора, а в отражении почему-то осталась «правда»:
    // пересчёт обязан её погасить, иначе иконка на токене врала бы.
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.inRage = false;
    system.conditions.inRage = true;
    const list = [];
    list.get = () => null;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
    });
    expect(system.conditions.inRage).toBe(false);
  });

  it("метки НЕ хранятся: в чистой схеме их полей нет вовсе", () => {
    // Хранимое поле завело бы второе место правды — ровно то, от чего этот
    // шаг уходит. Поле появляется только после пересчёта, как производное.
    const raw = new ACTOR_DATA_MODELS.character({}).toObject();
    for (const key of CONDITION_MARK_KEYS) expect(raw.conditions[key]).toBeUndefined();
  });
});

describe("книжные Состояния метками не задеты", () => {
  it("Оглушение как хранилось, так и хранится", () => {
    const s = characterWith({ system: { inRage: true } });
    expect(s.conditions.stunned).toBe(false);
    const on = new ACTOR_DATA_MODELS.character({}).toObject();
    expect(on.conditions.stunned).toBe(false);   // поле в схеме есть, в отличие от меток
    expect(Object.hasOwn(on.conditions, "stunned")).toBe(true);
  });
});
