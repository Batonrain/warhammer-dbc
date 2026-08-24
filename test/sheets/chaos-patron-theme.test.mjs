// test/sheets/chaos-patron-theme.test.mjs
//
// Тема Бога-покровителя вешается на корень листа из _applyChaosPatronTheme()
// (PARTS.body.root=true отбрасывает корневой элемент шаблона — см. комментарий
// у метода). Баг «классы темы не доходят до DOM» здесь уже третий по счёту,
// поэтому у метода есть свой тест: классы и переменные ставятся у Хаосита,
// снимаются у лоялиста и НЕ трогают чужие листы (Демон/Принц наследуют этот
// класс и тоже ходят alignment="heretic" по умолчанию).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";

const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

function themedSheet({ type = "character", alignment = "heretic", patronGod } = {}) {
  const classes = new Set();
  const vars = {};
  const root = {
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      [Symbol.iterator]: function* () { yield* classes; }
    },
    style: {
      setProperty: (k, v) => { vars[k] = v; },
      removeProperty: k => { delete vars[k]; }
    }
  };
  const sheet = Object.create(WarhammerCharacterSheet.prototype);
  Object.defineProperty(sheet, "actor", {
    value: { type, system: { alignment, patronGod } }, configurable: true
  });
  Object.defineProperty(sheet, "element", { value: root, configurable: true });
  return { sheet, classes, vars };
}

describe("тема Бога-покровителя на корне листа", () => {
  it("Хаосит получает классы и переменные своего Бога", () => {
    const { sheet, classes, vars } = themedSheet({ patronGod: "slaanesh" });
    sheet._applyChaosPatronTheme();
    expect([...classes]).toContain("chaos-heretic");
    expect([...classes]).toContain("chaos-god-slaanesh");
    expect(vars["--gc"]).toBeTruthy();
    expect(vars["--patron-sigil"]).toMatch(/^url\(/);
  });

  it("у лоялиста тема снимается вместе с переменными", () => {
    const { sheet, classes, vars } = themedSheet({ patronGod: "khorne" });
    sheet._applyChaosPatronTheme();
    Object.defineProperty(sheet, "actor", {
      value: { type: "character", system: { alignment: "loyalist" } }, configurable: true
    });
    sheet._applyChaosPatronTheme();
    expect([...classes].filter(c => c.startsWith("chaos-"))).toEqual([]);
    expect(vars["--gc"]).toBeUndefined();
  });

  it("чужой лист (Демон) тему патрона не получает", () => {
    const { sheet, classes, vars } = themedSheet({ type: "daemon" });
    sheet._applyChaosPatronTheme();
    expect([...classes]).toEqual([]);
    expect(Object.keys(vars)).toEqual([]);
  });
});
