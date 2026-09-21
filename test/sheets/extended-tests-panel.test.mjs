// test/sheets/extended-tests-panel.test.mjs
//
// Панель «Расширенные тесты» на вкладке ПОКАЗАТЕЛИ (стр. 25, wdbc-nysl):
// «Переоткрыть» ведёт в тот же диалог броска, что и клик по Навыку/
// Характеристике, но предзаполненный на Вид «Расширенный» с сохранённым
// названием/целью; ручная правка банка и удаление строки — без диалога вовсе.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeForm } from "../support/foundry-stub.mjs";

const { WarhammerCharacterSheet, onExtendedTestReroll, onExtendedTestAdjust, onExtendedTestDelete } =
  await import("../../module/sheets/actor-sheet.mjs");

const sheet = system => sheetOf(WarhammerCharacterSheet, {
  characteristics: { wp: { total: 40 }, int: { total: 50 } },
  skills: { medicae: { total: 60 } },
  ...system
});

/** Подставной DOM-узел кнопки строки панели: closest(".extended-test-row") даёт row. */
function rowButton(key, row) {
  return { dataset: { key }, closest: sel => (sel === ".extended-test-row" ? row : null) };
}
function rowWith(fields) {
  return { querySelector: sel => fields[sel] ?? null };
}

beforeEach(resetCaptured);

describe("onExtendedTestReroll", () => {
  it("Навык: открывает диалог на Виде «Расширенный» с сохранённым названием/целью", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.вязь_зарока",
      { accumulated: 5, target: 30, label: "Вязь Зарока", testKey: "skill:medicae" });

    const row = rowWith({ ".extended-test-target": { value: "skill:medicae" } });
    onExtendedTestReroll.call(s, {}, rowButton("вязь_зарока", row));

    expect(captured.dialog.window.title).toBe("Проверка: Медика");
    expect(captured.dialog.content).toContain('id="extended-label" type="text" value="Вязь Зарока"');
    expect(captured.dialog.content).toContain('id="extended-goal" type="number" value="30"');
    expect(captured.dialog.content).toContain('id="kind-extended" checked');
  });

  it("Навык можно сменить в селекте строки перед «Переоткрыть»", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.тест",
      { accumulated: 0, target: 10, label: "Тест", testKey: "skill:medicae" });

    // Игрок переключил селект строки на другой Навык до нажатия кнопки —
    // «Переоткрыть» обязан бросать ИМ, не тем, что было сохранено раньше.
    const row = rowWith({ ".extended-test-target": { value: "char:wp" } });
    onExtendedTestReroll.call(s, {}, rowButton("тест", row));

    expect(captured.dialog.window.title).toBe("Проверка: Воля");
  });

  it("Характеристика: тот же путь, что и клик по Характеристике на листе", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.молитва",
      { accumulated: 2, target: 20, label: "Молитва", testKey: "char:wp" });

    const row = rowWith({ ".extended-test-target": { value: "char:wp" } });
    onExtendedTestReroll.call(s, {}, rowButton("молитва", row));

    expect(captured.dialog.window.title).toBe("Проверка: Воля");
    expect(captured.dialog.content).toContain('id="extended-label" type="text" value="Молитва"');
    expect(captured.dialog.content).toContain('id="extended-goal" type="number" value="20"');
  });

  it("без банка на акторе — ничего не открывает", () => {
    const s = sheet({});
    const row = rowWith({ ".extended-test-target": { value: "skill:medicae" } });
    onExtendedTestReroll.call(s, {}, rowButton("нет_такого", row));
    expect(captured.dialog).toBeNull();
  });

  // Банк, набитый ДО появления testKey, цели не помнит: строка панели
  // подставляет плашку «— выберите тест —» с пустым value (sheets/
  // sheet-helpers.mjs), и «Переоткрыть» обязано молча выйти. Иначе браузер
  // пометил бы первый <option> списка и панель бросала бы ЧУЖОЙ Навык
  // (приёмка стопки #482-#504).
  it("старый банк без testKey — с плашкой-заглушкой ничего не бросает", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.старый_банк",
      { accumulated: 12, target: 30, label: "Старый банк" });
    const row = rowWith({ ".extended-test-target": { value: "" } });
    onExtendedTestReroll.call(s, {}, rowButton("старый_банк", row));
    expect(captured.dialog).toBeNull();
  });

  it("продолжает тот же банк — бросок через панель копит в тот же ключ", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.вязь_зарока",
      { accumulated: 5, target: 30, label: "Вязь Зарока", testKey: "skill:medicae" });

    const row = rowWith({ ".extended-test-target": { value: "skill:medicae" } });
    const promise = onExtendedTestReroll.call(s, {}, rowButton("вязь_зарока", row));
    captured.nextRoll = 30;
    await captured.press("roll", fakeForm({
      "#skill-target": "60", "#skill-char-select": "int", "#skill-modifier": "0",
      "#kind-extended": true, "#extended-label": "Вязь Зарока", "#extended-goal": "30"
    }));
    await promise;

    const flag = s.actor.getFlag("warhammer-dbc", "extendedTests.вязь_зарока");
    expect(flag.accumulated).toBeGreaterThan(5);
  });
});

describe("onExtendedTestAdjust", () => {
  it("положительная правка прибавляет к банку", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.тест", { accumulated: 5, target: 30, label: "Тест" });
    const row = rowWith({ ".extended-test-delta": { value: "10" } });
    await onExtendedTestAdjust.call(s, {}, rowButton("тест", row));
    expect(s.actor.getFlag("warhammer-dbc", "extendedTests.тест").accumulated).toBe(15);
  });

  it("отрицательная правка (Критический Провал −5..−15) вычитает, не уходя ниже нуля", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.тест", { accumulated: 5, target: 30, label: "Тест" });
    const row = rowWith({ ".extended-test-delta": { value: "-15" } });
    await onExtendedTestAdjust.call(s, {}, rowButton("тест", row));
    expect(s.actor.getFlag("warhammer-dbc", "extendedTests.тест").accumulated).toBe(0);
  });

  it("пустое поле — ничего не меняет", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.тест", { accumulated: 5, target: 30, label: "Тест" });
    const row = rowWith({ ".extended-test-delta": { value: "" } });
    await onExtendedTestAdjust.call(s, {}, rowButton("тест", row));
    expect(s.actor.getFlag("warhammer-dbc", "extendedTests.тест").accumulated).toBe(5);
  });
});

describe("onExtendedTestDelete", () => {
  it("убирает банк из флагов актора", async () => {
    const s = sheet({});
    await s.actor.setFlag("warhammer-dbc", "extendedTests.тест", { accumulated: 5, target: 30, label: "Тест" });
    await onExtendedTestDelete.call(s, {}, { dataset: { key: "тест" } });
    expect(s.actor.getFlag("warhammer-dbc", "extendedTests.тест")).toBeUndefined();
  });
});
