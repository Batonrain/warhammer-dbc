// test/sheets/aspirations-place.test.mjs
//
// Стремления выбираются на вкладке «Записи» — и только там. Раньше (до
// 23.08.2026) выбор жил в шапке листа; при разборе шапки на этапе переноса
// Мировоззрения/Геносемени/Культуры/Фракции/Происхождения/Предсказания в
// Записи и Настройки листа Стремления вернули туда же, откуда когда-то
// переехали в шапку — одно поле снова на одной поверхности.
//
// Проверяется разметка, а не рендер: Foundry в тестах не запускается, но
// расползание этих двух шаблонов видно и по их содержимому.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

const HEADER = read("templates/actor/parts/header.hbs");
const NOTES  = read("templates/actor/parts/tab-notes.hbs");

describe("место Стремлений на листе", () => {
  it("выбор, «Своё» и очистка живут на «Записях»", () => {
    expect(NOTES).toContain("aspirationSlots");
    expect(NOTES).toContain("aspir-select");
    expect(NOTES).toContain("aspir-custom-name");
    expect(NOTES).toContain("aspir-custom-mods");
    expect(NOTES).toContain("aspir-remove");
    expect(NOTES).toContain("СТРЕМЛЕНИЯ");
  });

  it("бросок d10 и «без модификаторов» есть и на листе, и в Мастере (стр. 22)", () => {
    const WIZARD = read("templates/apps/character-wizard.hbs");
    for (const tpl of [NOTES, WIZARD]) {
      expect(tpl).toContain("aspir-roll");
      expect(tpl).toContain("aspir-nomods");
    }
  });

  it("«Выбрать Характеристики» есть и на листе, и в Мастере", () => {
    for (const tpl of [NOTES, read("templates/apps/character-wizard.hbs")]) expect(tpl).toContain("aspir-repick");
  });

  it("подсказка не велит применять модификаторы руками — их применяет Механика", () => {
    expect(NOTES).not.toContain("применяются к Базе вручную");
    expect(read("templates/item/parts/aspiration.hbs")).not.toContain("сам движок их не считает");
  });

  it("в шапке Стремлений не осталось вовсе", () => {
    expect(HEADER).not.toContain("aspir");
    expect(HEADER).not.toContain("aspirationSlots");
  });
});
