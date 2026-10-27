// test/rules/trophy-points.test.mjs
//
// Очки Трофеев Мастера Казней (Sahara task-bbe1, решение владельца 27.10.2026): пул на акторе
// system.trophyPoints {value, max}. Книга (Собиратель Трофеев, Трофеи Приговора/Триумфа): +1 очко
// за убитого офицера/чемпиона/чудовище (по усмотрению ГМа), максимум P.b; тратятся Туманным
// Прыжком и Окончательной Казнью. Тест — на НАСТОЯЩЕЙ схеме персонажа и документах пака.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import {
  hasTrophyPoints, trophyMax, trophyValue, trophyUpdate
} from "../../module/rules/trophy-points.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const TROPHY_TAKER = () => packDoc("traits", "tsDD6o4bwQ6Nxawy");
const MIST_LEAP = () => packDoc("talents", "GT0mCLQ13cgAwr9y");
const FINAL_EXECUTION = () => packDoc("talents", "WVsAgRZSj7cPhzoM");
const CLERK = () => ({ name: "Hammer / Молот", type: "gear", system: {} });

/** Персонаж из настоящей схемы; производные считает настоящий prepareDerivedData. */
function characterWith(docs = [], { perBonus = 4, value = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.per.base = perBonus * 10; // Бонус считает сам пересчёт листа: база 50 → P.b 5
  system.trophyPoints.value = value;
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const actor = { type: "character", name: "Мастер Казней", system, items, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}

describe("схема: пул Очков Трофеев", () => {
  it("у настоящего персонажа есть system.trophyPoints {value:0, max:0} (миграция не нужна)", () => {
    const sys = new ACTOR_DATA_MODELS.character({}).toObject();
    expect(sys.trophyPoints).toEqual({ value: 0, max: 0 });
    for (const type of ["daemon", "demonPrince", "minion"]) {
      expect(new ACTOR_DATA_MODELS[type]({}).toObject().trophyPoints).toEqual({ value: 0, max: 0 });
    }
  });
});

describe("кому положены Очки Трофеев (по настоящим документам пака)", () => {
  it("Собиратель Трофеев (Черта), Туманный Прыжок и Окончательная Казнь (Таланты) — да; прочее — нет", () => {
    expect(hasTrophyPoints(characterWith([TROPHY_TAKER()]))).toBe(true);
    expect(hasTrophyPoints(characterWith([MIST_LEAP()]))).toBe(true);
    expect(hasTrophyPoints(characterWith([FINAL_EXECUTION()]))).toBe(true);
    expect(hasTrophyPoints(characterWith([CLERK()]))).toBe(false);
    expect(hasTrophyPoints(characterWith([]))).toBe(false);
  });

  it("тексты в паке действительно говорят про Очки Трофеев (гейт не на пустом месте)", () => {
    for (const d of [TROPHY_TAKER(), MIST_LEAP(), FINAL_EXECUTION()]) {
      expect(String(d.system.benefit)).toMatch(/Очк[а-я]* Трофе|очк[а-я]* Трофе/i);
    }
    expect(TROPHY_TAKER().system.benefit).toContain("P.b"); // «макс. P.b»
  });
});

describe("максимум и зажим (rules/character.mjs, как у Рун Сигиллитов)", () => {
  it("максимум = P.b у носителя, 0 у остальных", () => {
    expect(characterWith([TROPHY_TAKER()], { perBonus: 5 }).system.trophyPoints.max).toBe(5);
    expect(characterWith([CLERK()], { perBonus: 5 }).system.trophyPoints.max).toBe(0);
    expect(trophyMax(characterWith([TROPHY_TAKER()], { perBonus: 3 }))).toBe(3);
  });

  it("накопленное выше максимума срезается производными; без источника — обнуляется", () => {
    expect(characterWith([TROPHY_TAKER()], { perBonus: 4, value: 9 }).system.trophyPoints.value).toBe(4);
    expect(characterWith([TROPHY_TAKER()], { perBonus: 4, value: 2 }).system.trophyPoints.value).toBe(2);
    expect(characterWith([CLERK()], { perBonus: 4, value: 3 }).system.trophyPoints.value).toBe(0);
  });
});

describe("trophyUpdate: начисление/трата с зажимом в 0…P.b", () => {
  const holder = (value, perBonus = 4) => characterWith([TROPHY_TAKER()], { perBonus, value });

  it("+1, −1, зажим сверху и снизу; ничего менять не надо — null", () => {
    expect(trophyUpdate(holder(2), +1)).toEqual({ "system.trophyPoints.value": 3 });
    expect(trophyUpdate(holder(2), -1)).toEqual({ "system.trophyPoints.value": 1 });
    expect(trophyUpdate(holder(4), +1)).toBeNull();
    expect(trophyUpdate(holder(0), -1)).toBeNull();
    expect(trophyUpdate(holder(3), +9)).toEqual({ "system.trophyPoints.value": 4 });
    expect(trophyValue(holder(3))).toBe(3);
  });

  it("не носитель — null (пул ему не положен)", () => {
    expect(trophyUpdate(characterWith([CLERK()], { value: 0 }), +1)).toBeNull();
  });
});
