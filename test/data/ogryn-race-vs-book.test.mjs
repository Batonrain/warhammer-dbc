// test/data/ogryn-race-vs-book.test.mjs
//
// РАСА ОГРИН ПРОТИВ КНИГИ (сверка главы I, 28.09.2026).
//
// Что нашлось при сверке и больше не должно вернуться:
//   • Конструктор расы выдавал Огрину две Черты Сквата — «Clever Hands» и
//     «Hard as Stone»; в книге у Огрина их нет;
//   • резерв-константы держали Крупную Базу 3×3 (wdbc-8k0i, книга:
//     «Существа покрупнее … вроде Огринов … Базами 3×3»), а документ расы в
//     паке — нет, и живой мир ставил Огрину Базу 2×2;
//   • резерв-константы держали человеческие 25 во всех Характеристиках.
//
// Числа сверяются с текстом книги (packs-src/books/core.json), а не с памятью:
// тот же приём, что test/data/legion-geneseed-size-vs-book.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RACES } from "../../module/constants/races.mjs";
import { OGRYN_REGEN_PERIOD } from "../../module/rules/ogryn-regen.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { collectTestMods } from "../../module/rules/roll-mods.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const RACE = packDocById("packs-src/races/Люди", "tjQaSHFHxbt1tvWU");
const BRUTE = packDocById("packs-src/traits", "ZM5JfxTzLTfByO46");
const BONE = packDocById("packs-src/traits", "EfjH6ckVGO5eTfrp");

/** Плоский текст основной книги без разметки и переносов по слогам. */
function coreBookText() {
  const book = readJson("packs-src/books/core.json");
  return book.entries
    .flatMap(e => e.pages.map(p => p.html || ""))
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}
const BOOK = coreBookText();
const ogrynSection = BOOK.slice(BOOK.indexOf("самой распространенной расы аблюдей"), BOOK.indexOf("самой физически маленькой расы"));

const entries = doc => (doc.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries);

// Огрин с НАСТОЯЩЕЙ Чертой из пака — модификаторы едут тем же путём, что в игре
// (источники «items» и «core» конвейера теста).
const asItem = doc => ({ id: doc._id, name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });
const OGRYN = { id: "a1", type: "character", system: { characteristics: {}, skills: {} },
                items: Object.assign([asItem(BRUTE)], { contents: [asItem(BRUTE)] }) };
const fineMods = mods => mods.filter(m => m.value === -20);

describe("Огрин: данные расы", () => {
  it("раздел книги найден — иначе проверки ниже зелены от пустоты", () => {
    expect(ogrynSection.length).toBeGreaterThan(1000);
    expect(ogrynSection).toContain("Brute Physiology");
  });

  it("стартовые Характеристики — как в книге, в паке и в резерв-константах", () => {
    const book = { ws: 25, bs: 25, s: 40, t: 45, ag: 15, int: 10, per: 25, wp: 25, fel: 20, inf: 14 };
    expect(ogrynSection).toContain("25 25 40 45 15 10 25 25 20 0 14");
    expect(RACE.system.chars).toEqual(book);
    expect(RACES.ogryn.chars).toEqual(book);
  });

  it("Черты Сквата у Огрина не выдаются", () => {
    const names = entries(RACE).filter(e => e.kind === "trait").map(e => e.sourceName);
    expect(names).not.toContain("Clever Hands / Умелые Руки");
    expect(names).not.toContain("Hard as Stone / Крепкий как Камень");
    expect(names).toEqual(expect.arrayContaining([
      "Fanatic / Фанатик", "Brute Physiology / Физиология Громилы", "BONE-Head / Костеголов"
    ]));
    expect(RACES.ogryn.traits.map(t => t.name).join(" ")).not.toMatch(/Clever Hands|Hard as Stone/);
  });

  it("Крупная База 3×3 — и в паке, и в константах", () => {
    expect(BOOK).toMatch(/вроде Огринов[^.]*Базами 3×3/);
    expect(RACE.system.largeBase).toBe(true);
    expect(RACES.ogryn.largeBase).toBe(true);
  });

  it("стартовое снаряжение — дословно книга", () => {
    const gear = "3 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q, Все стартовое снаряжение бесплатно модифицируется под Огрина";
    expect(ogrynSection).toContain("3 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q");
    expect(ogrynSection).toContain("Все стартовое снаряжение бесплатно модифицируется под Огрина");
    expect(RACE.system.gear).toBe(gear);
    expect(RACES.ogryn.gear).toBe(gear);
  });
});

describe("Огрин: Физиология Громилы — числа против книги", () => {
  it("+15 к максимуму Ран", () => {
    expect(ogrynSection).toContain("Огрин получает +15 к максимуму Ран");
    const w = entries(BRUTE).find(e => e.kind === "wounds");
    expect(w?.woundsValue).toBe("15");
  });

  it("периоды восстановления: минута, 10 минут, час", () => {
    expect(ogrynSection).toMatch(/легко ранен, он пассивно восстанавливает 1 Рану в минуту, если тяжело ранен – 1 Рану в 10 минут, а если критически ранен – 1 Рану в час/);
    expect(OGRYN_REGEN_PERIOD).toEqual({ light: 60, heavy: 600, critical: 3600 });
  });

  it("−20 на тонкую манипуляцию — одна галочка (askOnly) на Ремесле, Техпользовании, Безопасности, Ловкости Рук", () => {
    expect(ogrynSection).toContain("штраф –20 на все тесты тонкой манипуляции");
    for (const ctx of [
      { kind: "skill", group: "trade", char: "int" },
      { kind: "skill", skill: "techUse", char: "int" },
      { kind: "skill", skill: "security", char: "ag" },
      { kind: "skill", skill: "sleightOfHand", char: "ag" }
    ]) {
      expect(fineMods(resolveTest({ actor: OGRYN, ...ctx }).mods)).toEqual([expect.objectContaining({ value: -20, askOnly: true })]);
    }
  });

  // wdbc-6rjtc.1: запись Конструктора «Модификатор теста» (modScope "all", без
  // askOnly) складывалась сама в каждом броске без диалога — Огрин молча
  // получал −20 на Уклонение, Парирование, Страх, Панику и т.д.
  it("сторож: Уклонение, Парирование, Страх, тест T — ни галочки, ни −20 без диалога", () => {
    for (const ctx of [
      { kind: "skill", skill: "dodge", char: "ag" },
      { kind: "skill", skill: "parry", char: "ws" },
      { kind: "skill", char: "wp", morale: true },
      { kind: "skill", char: "t" }
    ]) {
      expect(fineMods(resolveTest({ actor: OGRYN, ...ctx }).mods)).toEqual([]);
      expect(collectTestMods(OGRYN, ctx).total).toBe(0);
    }
  });

  it("сторож: и на Техпользовании без диалога (Расклин) −20 само не складывается", () => {
    expect(collectTestMods(OGRYN, { kind: "skill", skill: "techUse", char: "int" }).total).toBe(0);
  });

  it("возможности и иммунитет к Обескровливанию — на самой Черте (их получает и Миньон «Огрин»)", () => {
    const caps = entries(BRUTE).filter(e => e.kind === "capability").map(e => e.capabilityKey);
    expect(caps).toEqual(expect.arrayContaining([
      "weapons.ogryn", "brutePhysiology.passiveRegen", "brutePhysiology.bleedingNoDeath", "brutePhysiology.shakeOffStun"
    ]));
    expect(entries(BRUTE).some(e => e.kind === "condition" && e.condKey === "haemorrhaging" && e.condMode === "immunity")).toBe(true);
  });

  it("полный книжный текст в benefit обеих Черт", () => {
    expect(BRUTE.system.benefit).toContain("кроме гранат");
    expect(BRUTE.system.benefit).toContain("Trade (Weaponsmith)+0");
    expect(BONE.system.benefit).toContain("при Успехе дает не больше 1 Успеха");
    expect(BONE.system.benefit).toContain("интенсивностью 7+");
  });
});
