// test/sheets/v2-helpers.test.mjs
//
// Общая обвязка листов на ApplicationV2 (wdbc-7vt). Три помощника были
// скопированы по листам: whenEditable — в четыре, onTab — в четыре,
// filePicker — в два. Здесь они проверяются один раз за всех.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { whenEditable, onTab, filePicker } from "../../module/sheets/v2-helpers.mjs";

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
