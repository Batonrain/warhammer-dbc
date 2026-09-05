// test/rules/item-name-cache.test.mjs
//
// Разбор имени предмета кэшируется на самом предмете (wdbc-uvap).
//
// itemHasName() — самое горячее место пересчёта листа после сборки правил: в
// профиле (node --cpu-prof, актор на 120 предметов) на нормализацию имени и
// регулярку отсечения специализации уходило около трети всего пересчёта.
// Причина не в самой функции, а в числе вызовов: 57 Талантов опознаются по
// литеральному имени (wdbc-iadw), и каждый вопрос заново приводит имя
// КАЖДОГО предмета к нижнему регистру, режет по «/» и гоняет регулярку.
//
// Кэш живёт на предмете и сверяется с сырым именем: переименование предмета
// обязано быть видно немедленно, иначе правка в компендиуме «применяется
// через раз».

import { describe, it, expect } from "vitest";
import { itemHasName } from "../../module/rules/predicates.mjs";

describe("itemHasName — сравнение по любой половине двуязычного имени", () => {
  const item = { name: "Gene-Seed / Геносемя" };

  it("находит по английской половине", () => {
    expect(itemHasName(item, "Gene-Seed")).toBe(true);
  });

  it("находит по русской половине", () => {
    expect(itemHasName(item, "Геносемя")).toBe(true);
  });

  it("не зависит от регистра и пробелов по краям", () => {
    expect(itemHasName(item, "  gene-seed ")).toBe(true);
  });

  it("специализация в скобках при сравнении отбрасывается", () => {
    expect(itemHasName({ name: "Resistance (Cold) / Сопротивление (Холод)" }, "Resistance")).toBe(true);
  });

  it("чужое имя не находится", () => {
    expect(itemHasName(item, "Black Carapace")).toBe(false);
  });

  it("пустое искомое имя не находится никогда", () => {
    expect(itemHasName(item, "")).toBe(false);
    expect(itemHasName(item, null)).toBe(false);
  });

  it("предмет без имени не ломает сравнение", () => {
    expect(itemHasName({}, "Frenzy")).toBe(false);
    expect(itemHasName(null, "Frenzy")).toBe(false);
  });
});

describe("кэш разбора имени не переживает переименование предмета", () => {
  it("переименованный предмет сразу отвечает по новому имени", () => {
    const item = { name: "Frenzy / Ярость" };
    expect(itemHasName(item, "Frenzy")).toBe(true);   // кладёт разбор в кэш

    item.name = "Sure Strike / Точный Удар";
    expect(itemHasName(item, "Frenzy")).toBe(false);  // старое имя больше не находится
    expect(itemHasName(item, "Sure Strike")).toBe(true);
  });

  it("два предмета с одинаковым именем не делят один ответ ошибочно", () => {
    const a = { name: "Frenzy / Ярость" };
    const b = { name: "Frenzy / Ярость" };
    expect(itemHasName(a, "Frenzy")).toBe(true);
    expect(itemHasName(b, "Frenzy")).toBe(true);
    b.name = "Adjutant / Адъютант";
    expect(itemHasName(a, "Frenzy")).toBe(true);
    expect(itemHasName(b, "Frenzy")).toBe(false);
  });

  it("сырые данные пака (не документ) тоже сравниваются", () => {
    // Часть вызовов приходит не с живого документа, а с объекта из packs-src.
    expect(itemHasName({ name: "Bone Song / Песнь Кости", type: "talent" }, "Bone Song")).toBe(true);
  });
});
