// test/sheets/v2-helpers.test.mjs
//
// Общая обвязка листов на ApplicationV2 (wdbc-7vt). Три помощника были
// скопированы по листам: whenEditable — в четыре, onTab — в четыре,
// filePicker — в два. Здесь они проверяются один раз за всех.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { whenEditable, onTab, filePicker, linesToArray } from "../../module/sheets/v2-helpers.mjs";

describe("whenEditable", () => {
  it("пропускает вызов на редактируемом листе, отдавая event и target", () => {
    const seen = [];
    const guarded = whenEditable(function (event, target) { seen.push([this, event, target]); });
    const sheet = { isEditable: true };

    guarded.call(sheet, "ev", "tg");

    expect(seen).toEqual([[sheet, "ev", "tg"]]);
  });

  it("молчит на нередактируемом листе", () => {
    let called = false;
    const guarded = whenEditable(() => { called = true; });

    guarded.call({ isEditable: false }, {}, {});

    expect(called).toBe(false);
  });

  it("возвращает результат обёрнутого действия", async () => {
    const guarded = whenEditable(async () => "готово");
    await expect(guarded.call({ isEditable: true }, {}, {})).resolves.toBe("готово");
  });
});

describe("onTab", () => {
  it("переключает вкладку по data-атрибутам кнопки", () => {
    const calls = [];
    const sheet = { changeTab: (...a) => calls.push(a) };

    onTab.call(sheet, {}, { dataset: { tab: "notes", group: "primary" } });

    expect(calls).toEqual([["notes", "primary"]]);
  });
});

describe("filePicker", () => {
  it("берёт реализацию из namespace: в v13 глобальный FilePicker устарел", () => {
    const apps = foundry.applications.apps;
    const Impl = class {};
    foundry.applications.apps = { FilePicker: { implementation: Impl } };

    expect(filePicker()).toBe(Impl);

    foundry.applications.apps = apps;
  });

  it("без namespace откатывается на глобальный", () => {
    const apps = foundry.applications.apps;
    foundry.applications.apps = undefined;

    expect(filePicker()).toBe(globalThis.FilePicker);

    foundry.applications.apps = apps;
  });
});

// Субраса: «Снимает Черты» — ArrayField(StringField), а на листе одна textarea
// (имя на строку). Foundry сама собирает массив из формы, только когда одно
// имя поля дают несколько input'ов — одиночная textarea шлёт строку целиком,
// item-sheet.mjs зовёт linesToArray перед тем, как отдать значение схеме.
describe("linesToArray", () => {
  it("строки textarea становятся массивом имён", () => {
    expect(linesToArray("Nimble\nPsyker")).toEqual(["Nimble", "Psyker"]);
  });

  it("пустые и пробельные строки не превращаются в пустые элементы", () => {
    expect(linesToArray("Nimble\n\n   \nPsyker\n")).toEqual(["Nimble", "Psyker"]);
  });

  it("уже сохранённый массив переживает повторное сохранение без изменений", () => {
    // Так лист отрисовывает массив обратно в textarea (join) и получает его
    // назад при следующей отправке формы (split) — цикл не должен искажать данные.
    const saved = ["Nimble", "Psyker", "Fleshbane"];
    expect(linesToArray(saved.join("\n"))).toEqual(saved);
  });

  it("без значения отдаёт пустой массив", () => {
    expect(linesToArray("")).toEqual([]);
    expect(linesToArray(undefined)).toEqual([]);
  });
});
