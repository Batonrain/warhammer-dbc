// test/apps/content-sync-app-v2.test.mjs
//
// ContentSyncApp — окно «Обновить мир», переведённое на ApplicationV2
// (wdbc-x66t.2, по образцу RigManager из wdbc-x66t.1). Рендера здесь нет —
// Foundry в тестах не запускается, — проверяется договор с шаблоном (общий
// describeV2Sheet) и разводка _onRender.
//
// ОСОБЫЙ РИСК этого файла: game.settings.registerMenu (Foundry v14) требует,
// чтобы type пункта меню наследовал FormApplication или ApplicationV2 —
// иначе синхронный бросок при регистрации обрывает остаток общего
// Hooks.once("init", ...) в warhammer-dbc.mjs, и ВСЕ настройки системы,
// зарегистрированные после этого пункта меню, перестают регистрироваться на
// живом мире. Тесты ниже не могут проверить сам registerMenu (это требует
// живого Foundry), поэтому этот риск нужно перепроверить вручную в игре —
// см. отчёт задачи.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { ContentSyncApp } from "../../module/apps/content-sync-app.mjs";

describeV2Sheet(ContentSyncApp, {
  sheet: "module/apps/content-sync-app.mjs",
  template: "templates/apps/content-sync.hbs"
});

function appLike(nodes = {}) {
  const handlers = {};
  const app = Object.create(ContentSyncApp.prototype);
  app.report = { rows: [], unmatched: [] };
  app.selected = new Set();
  app.expanded = new Set();
  app.element = listenerRoot(nodes, handlers);
  app.render = () => {};
  return app;
}

describe("_onRender: разводка кнопок", () => {
  it("[data-act=toggle-group] (click) раскрывает/сворачивает группу по data-row", () => {
    const rowEl = { closest: () => ({ dataset: { row: "r1" } }) };
    const app = appLike({ "[data-act=toggle-group]": [{ dataset: {}, currentTarget: undefined }] });
    ContentSyncApp.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-act=toggle-group]:click"]({ currentTarget: rowEl });
    expect(app.expanded.has("r1")).toBe(true);
    app.element.handlers["[data-act=toggle-group]:click"]({ currentTarget: rowEl });
    expect(app.expanded.has("r1")).toBe(false);
  });

  it("[data-entry] (change) добавляет/убирает entryKey из selected по checked", () => {
    const app = appLike({ "[data-entry]": [{ dataset: {} }] });
    ContentSyncApp.prototype._onRender.call(app, {}, {});
    const target = { dataset: { entry: "i1::dmg" }, checked: true };
    app.element.handlers["[data-entry]:change"]({ currentTarget: target });
    expect(app.selected.has("i1::dmg")).toBe(true);
    target.checked = false;
    app.element.handlers["[data-entry]:change"]({ currentTarget: target });
    expect(app.selected.has("i1::dmg")).toBe(false);
  });

  it("[data-act=toggle-row] (change) массово отмечает/снимает все записи строки", () => {
    const row = { key: "r1", entries: [{ entryKey: "i1::dmg" }, { entryKey: "i2::dmg" }] };
    const app = appLike({ "[data-act=toggle-row]": [{ dataset: {} }] });
    app.report = { rows: [row], unmatched: [] };
    ContentSyncApp.prototype._onRender.call(app, {}, {});
    const target = { dataset: { row: "r1" }, checked: true };
    app.element.handlers["[data-act=toggle-row]:change"]({ currentTarget: target });
    expect(app.selected.has("i1::dmg")).toBe(true);
    expect(app.selected.has("i2::dmg")).toBe(true);
    target.checked = false;
    app.element.handlers["[data-act=toggle-row]:change"]({ currentTarget: target });
    expect(app.selected.size).toBe(0);
  });

  // querySelector (в отличие от querySelectorAll) не оборачивает узел из
  // listenerRoot в addEventListener-заглушку — приходится давать её самим,
  // тем же форматом ключа "селектор:событие", что использует querySelectorAll.
  const querySelectorNode = handlers => {
    const node = { dataset: {} };
    node.addEventListener = (event, fn) => { handlers[`[data-act=${node._name}]:${event}`] = fn; };
    return node;
  };

  it("[data-act=refresh] (click) сбрасывает отчёт и просит полный ререндер", () => {
    let renderArg = null;
    const handlers = {};
    const refreshNode = querySelectorNode(handlers); refreshNode._name = "refresh";
    const app = appLike({ "[data-act=refresh]": [refreshNode] });
    app.render = force => { renderArg = force; };
    ContentSyncApp.prototype._onRender.call(app, {}, {});
    handlers["[data-act=refresh]:click"]();
    expect(app.report).toBe(null);
    expect(renderArg).toBe(true);
  });

  it("[data-act=apply] (click) зовёт _applySelected", () => {
    const handlers = {};
    const applyNode = querySelectorNode(handlers); applyNode._name = "apply";
    const app = appLike({ "[data-act=apply]": [applyNode] });
    const calls = [];
    app._applySelected = () => calls.push(true);
    ContentSyncApp.prototype._onRender.call(app, {}, {});
    handlers["[data-act=apply]:click"]();
    expect(calls).toEqual([true]);
  });
});
