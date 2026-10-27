// test/rules/apocrypha-coil.test.mjs
//
// Apocrypha Coil / Катушка Апокрифа (technomystic.core.apocryphaCoil), решение
// владельца 26.10.2026: поле system.apocryphaEnergy {value,max}; максимум —
// база основной Катушки БЕЗ бонусов Талантов (Силовой Заряд не влияет).
// Конвейер подготовки актора — тот же приём, что test/rules/power-cache.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const cap = key => ({ flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
  { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } } });

const apocryphaItem = () => ({ id: "ap", name: "Apocrypha Coil / Катушка Апокрифа", type: "talent", system: {},
  getFlag: () => undefined, ...cap("technomystic.core.apocryphaCoil") });
// То же Талант, но копия на акторе без записи Конструктора (до «Обновить мир») — опознаётся по имени.
const apocryphaItemOld = () => ({ id: "ap", name: "Apocrypha Coil / Катушка Апокрифа", type: "talent", system: {},
  getFlag: () => undefined, flags: {} });
const powerCacheItem = () => ({ id: "pc", name: "Power Cache / Силовой Заряд", type: "talent", system: {},
  getFlag: () => undefined, ...cap("technomystic.core.powerCache") });
const coilImplant = (quality = "good") => ({ id: "ic", name: "Potentia Coil / Катушка Потенции", type: "implant",
  system: { quality, energyMax: { poor: 1, common: 3, good: 5, best: 7 }, category: "" },
  getFlag: (_s, k) => (k === "installed" ? true : undefined), flags: {} });

function characterWith({ intBase = 42, items = [], energy = {}, apocryphaEnergy = {} } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.int.base = intBase;
  Object.assign(system.energy, energy);
  Object.assign(system.apocryphaEnergy, apocryphaEnergy);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Катушка Апокрифа: схема и максимум", () => {
  it("поле объявлено в схеме актора: value и max, по умолчанию 0", () => {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    expect(system.apocryphaEnergy).toEqual({ value: 0, max: 0 });
  });

  it("максимум = ручная база + установленная Катушка Потенции", () => {
    const s = characterWith({ items: [apocryphaItem(), coilImplant("good")], energy: { max: 2 } });
    expect(s.apocryphaEnergy.max).toBe(2 + 5);
  });

  it("Мотивные Банки (+5 к Катушке) в максимум Апокрифы НЕ входят — только имплант Катушки Потенции (решение владельца 27.10.2026)", () => {
    const banks = { id: "mb", name: "Manipulus Motive / Мотивные Банки", type: "implant",
      system: { quality: "common", energyMax: { poor: 5, common: 5, good: 5, best: 5 }, category: "" },
      getFlag: (_s, k) => (k === "installed" ? true : undefined), flags: {} };
    const s = characterWith({ items: [apocryphaItem(), coilImplant("good"), banks], energy: { max: 1 } });
    expect(s.energy.maxTotal).toBe(1 + 5 + 5);     // основная Катушка получает оба
    expect(s.apocryphaEnergy.max).toBe(1 + 5);      // Апокрифа — только Катушка Потенции
  });

  it("Силовой Заряд поднимает основную Катушку, но НЕ Апокрифу", () => {
    const s = characterWith({ intBase: 42, items: [apocryphaItem(), powerCacheItem(), coilImplant("common")] });
    expect(s.energy.maxTotal).toBe(3 + 2);        // 3 Катушка + ½I.b(4)=2
    expect(s.apocryphaEnergy.max).toBe(3);        // без +2 от Таланта
  });

  it("Талант на акторе без записи Конструктора (старая копия) опознаётся по имени", () => {
    const s = characterWith({ items: [apocryphaItemOld(), coilImplant("best")] });
    expect(s.apocryphaEnergy.max).toBe(7);
  });

  it("без Таланта максимум 0, а хранимый заряд не затирается", () => {
    const s = characterWith({ items: [coilImplant("good")], apocryphaEnergy: { value: 4 } });
    expect(s.apocryphaEnergy.max).toBe(0);
    expect(s.apocryphaEnergy.value).toBe(4);
  });

  it("заряд выше максимума обрезается по максимуму", () => {
    const s = characterWith({ items: [apocryphaItem(), coilImplant("common")], apocryphaEnergy: { value: 9 } });
    expect(s.apocryphaEnergy.max).toBe(3);
    expect(s.apocryphaEnergy.value).toBe(3);
  });

  it("настоящий Талант из пака несёт запись Конструктора technomystic.core.apocryphaCoil", () => {
    const doc = packDocById("packs-src/talents/Техномистик", "I5KYA2WhNHPleN8r");
    const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("technomystic.core.apocryphaCoil");
  });
});
