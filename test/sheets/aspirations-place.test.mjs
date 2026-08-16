// test/sheets/aspirations-place.test.mjs
//
// Стремления выбираются в шапке листа — и только там. Раньше выбор жил на
// вкладке «Записи», а шапка повторяла его текстом: одно поле на две
// поверхности, и игрок искал, где же его менять.
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
  it("выбор, «Своё» и очистка живут в шапке", () => {
    expect(HEADER).toContain("aspirationSlots");
    expect(HEADER).toContain("aspir-select");
    expect(HEADER).toContain("aspir-custom-name");
    expect(HEADER).toContain("aspir-custom-mods");
    expect(HEADER).toContain("aspir-remove");
  });

  it("на «Записях» Стремлений не осталось вовсе", () => {
    expect(NOTES).not.toContain("aspir");
    expect(NOTES).not.toContain("СТРЕМЛЕНИЯ");
  });

  it("шапка не показывает Стремления вторым, нередактируемым местом", () => {
    // header-readonly-val остался у Геносемени и Культуры, но не в строке Стремлений.
    const row = HEADER.slice(HEADER.indexOf("header-row-aspir"));
    expect(row).not.toContain("header-readonly-val");
  });
});
