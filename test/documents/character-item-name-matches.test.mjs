// test/documents/character-item-name-matches.test.mjs
//
// wdbc-rc5z: 8 матчей предметов по имени в module/rules/character.mjs
// (character.mjs:181, 315-317, 343, 484, 502, 763) переведены на itemHasName/
// giftNamesOf вместо голых /regex/i — здесь проверяется ДОВОД ДО АКТОРА через
// prepareDerivedData на реальных бигвальных именах пака, не только сама
// функция-предикат. Чёрный Панцирь и Core Memories уже покрыты
// test/documents/black-carapace-armour.test.mjs и
// test/documents/dreadnought-sanity.test.mjs — здесь остальные пять.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const talent = (name, system = {}) => ({ id: name, name, type: "talent", system, getFlag: () => undefined });
const gear = (name, system = {}) => ({ id: name, name, type: "gear", system, getFlag: () => undefined });
const trait = (name, system = {}) => ({ id: name, name, type: "trait", system, getFlag: () => undefined });

function characterWith(over = {}, items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  Object.assign(system, over);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Дары Одержимого (giftNamesOf) — реальные бигвальные имена пака", () => {
  function possessedWith(items) {
    return characterWith({
      alignment: "heretic",
      possessed: true,
      possession: { manifested: true },
      corruption: { value: 40 }
    }, items);
  }

  it("«Carapace / Дар: Панцирь» — Natural Armour = corB (40 → 4)", () => {
    const s = possessedWith([talent("Carapace / Дар: Панцирь")]);
    expect(s.possessionActive.applied.some(a => a.startsWith("Панцирь:"))).toBe(true);
  });

  it("«Giant / Дар: Гигант» — +1 Размер, +10 S", () => {
    const s = possessedWith([talent("Giant / Дар: Гигант")]);
    expect(s.sizeMod).toBe(1);
    expect(s.traitCharValueBonus.s).toBe(10);
  });

  it("«Daemonic Speed / Дар: Демоническая Скорость» — Unnatural A", () => {
    const s = possessedWith([talent("Daemonic Speed / Дар: Демоническая Скорость")]);
    expect(s.traitCharBonus.ag).toBe(Math.floor(Math.floor(40 / 10) / 2));
  });

  it("без Даров — ничего не применяется, кроме базового Проявления", () => {
    const s = possessedWith([]);
    expect(s.sizeMod).toBe(0);
    expect(s.possessionActive.applied.some(a => a.includes("Панцирь"))).toBe(false);
  });
});

describe("Клонирующее Поле (Clone Field) — реальное бигвальное имя пака", () => {
  it("«Clone Field / Клонирующее Поле» надетое — cloneField не null", () => {
    const s = characterWith({}, [gear("Clone Field / Клонирующее Поле", { worn: true, availability: 3, quality: "good" })]);
    expect(s.cloneField).not.toBeNull();
  });

  it("не надетое (worn:false) — cloneField null", () => {
    const s = characterWith({}, [gear("Clone Field / Клонирующее Поле", { worn: false })]);
    expect(s.cloneField).toBeNull();
  });

  it("нет предмета — cloneField null", () => {
    expect(characterWith({}, []).cloneField).toBeNull();
  });
});

describe("Бездонная Душа (Друкхари) — реальное бигвальное имя пака", () => {
  it("«Bottomless Soul / Бездонная Душа» ×2 поднимает максимум Очков Боли", () => {
    const s = characterWith({ race: "drukhari" }, [
      talent("Bottomless Soul / Бездонная Душа"),
      talent("Bottomless Soul / Бездонная Душа")
    ]);
    const wb = s.characteristics.wp.bonus ?? 0;
    expect(s.fate.max).toBe(wb * 3);
  });

  it("без Таланта — множитель ×1", () => {
    const s = characterWith({ race: "drukhari" }, []);
    const wb = s.characteristics.wp.bonus ?? 0;
    expect(s.fate.max).toBe(wb);
  });
});

describe("Ловит на Лету / Fast Learner — реальное бигвальное имя пака", () => {
  it("рейтинг Черты доходит до fastLearnerBonus", () => {
    const s = characterWith({}, [trait("Fast Learner / Ловит на Лету (X)", { rating: 15 })]);
    expect(s.fastLearnerBonus).toBe(15);
  });

  it("без Черты — 0", () => {
    expect(characterWith({}, []).fastLearnerBonus).toBe(0);
  });

  it("Талант с тем же именем (не trait) не считается", () => {
    const s = characterWith({}, [talent("Fast Learner / Ловит на Лету (X)", { rating: 15 })]);
    expect(s.fastLearnerBonus).toBe(0);
  });
});
