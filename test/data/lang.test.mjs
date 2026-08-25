// test/data/lang.test.mjs
//
// Словарь типов документов. Заголовок листа Foundry строит из TYPES.<Документ>
// .<тип>, и без записи показывает сам ключ: «TYPES.Actor.character: имя».
//
// Ловушка была не в самом словаре, а в языке: система объявляла только `ru`, а
// мир стоял на английском — Foundry брал английский словарь, которого не было,
// и печатал ключи. Поэтому `lang/en.json` объявлен тем же словарём: система
// русскоязычная целиком, и подписи должны быть верны при любом языке интерфейса.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const readJson = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const SYSTEM   = readJson("system.json");
const RU       = readJson("lang/ru.json");
const EN       = readJson("lang/en.json");

const ACTOR_TYPES = Object.keys(SYSTEM.documentTypes.Actor);
const ITEM_TYPES  = Object.keys(SYSTEM.documentTypes.Item);

describe("словарь типов документов", () => {
  it("каждый тип актора из system.json подписан", () => {
    const missing = ACTOR_TYPES.filter(t => !RU.TYPES?.Actor?.[t]);
    expect(missing).toEqual([]);
  });

  it("каждый тип предмета из system.json подписан", () => {
    const missing = ITEM_TYPES.filter(t => !RU.TYPES?.Item?.[t]);
    expect(missing).toEqual([]);
  });

  it("лишних подписей нет — тип, которого больше нет, вычищается вместе со схемой", () => {
    expect(Object.keys(RU.TYPES.Actor).filter(t => !ACTOR_TYPES.includes(t))).toEqual([]);
    expect(Object.keys(RU.TYPES.Item).filter(t => !ITEM_TYPES.includes(t))).toEqual([]);
  });
});

describe("языки системы", () => {
  it("объявлены и ru, и en — иначе на английском мире вылезают сырые ключи", () => {
    expect(SYSTEM.languages.map(l => l.lang).sort()).toEqual(["en", "ru"]);
    for (const lang of SYSTEM.languages)
      expect(fs.existsSync(path.join(root, lang.path))).toBe(true);
  });

  it("оба словаря совпадают дословно", () => {
    expect(EN).toEqual(RU);
  });
});
