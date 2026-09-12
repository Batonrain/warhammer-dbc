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

import { describe, it, expect, vi } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";

// wdbc-5tz: _ensureReport() ниже мокает buildLiveSyncReport, чтобы дважды
// прогнать его и проверить, что второй прогон ДОПОЛНЯЕТ this.expanded, а не
// заменяет — мок должен стоять ДО импорта content-sync-app.mjs (тот импортирует
// buildLiveSyncReport на верхнем уровне).
const buildLiveSyncReport = vi.fn();
vi.mock("../../module/apps/content-sync.mjs", () => ({
  buildLiveSyncReport: (...args) => buildLiveSyncReport(...args),
  applySyncReport: vi.fn(),
  fieldLabel: p => p,
  describeValue: () => null
}));

const { ContentSyncApp, rowsNeedingExpansion } = await import("../../module/apps/content-sync-app.mjs");

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

  // wdbc-1ccm: массовое переключение группы должно сразу разворачивать её —
  // иначе единственный видимый элемент управления свёрнутой группой с
  // несколькими акторами — агрегатный toggle-row, и точечно поправить одну
  // запись внутри (не трогая соседей) физически нечем, пока группа скрыта.
  it("[data-act=toggle-row] (change) разворачивает свою группу, чтобы точечные data-entry стали доступны", () => {
    const row = { key: "r1", entries: [{ entryKey: "i1::dmg" }, { entryKey: "i2::dmg" }, { entryKey: "i3::dmg" }] };
    const app = appLike({ "[data-act=toggle-row]": [{ dataset: {} }] });
    app.report = { rows: [row], unmatched: [] };
    ContentSyncApp.prototype._onRender.call(app, {}, {});
    expect(app.expanded.has("r1")).toBe(false);
    const target = { dataset: { row: "r1" }, checked: true };
    app.element.handlers["[data-act=toggle-row]:change"]({ currentTarget: target });
    expect(app.expanded.has("r1")).toBe(true);
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

// wdbc-1ccm: чистая функция, определяющая, какие группы стоит развернуть по
// умолчанию — без неё группа с конфликтными и чистыми записями вперемешку
// оставалась бы свёрнутой до первого клика ГМа, и единственным видимым
// элементом управления был бы toggle-row на всю группу разом.
describe("rowsNeedingExpansion: чистая функция авто-раскрытия неоднородных групп", () => {
  it("не трогает группу из одной записи (у соло-записи свой отдельный чекбокс)", () => {
    const rows = [{ key: "r1", entries: [{ entryKey: "i1::dmg" }] }];
    expect(rowsNeedingExpansion(rows, new Set(["i1::dmg"]))).toEqual(new Set());
  });

  it("не трогает группу, где выбраны ВСЕ записи", () => {
    const rows = [{ key: "r1", entries: [{ entryKey: "i1::dmg" }, { entryKey: "i2::dmg" }] }];
    expect(rowsNeedingExpansion(rows, new Set(["i1::dmg", "i2::dmg"]))).toEqual(new Set());
  });

  it("не трогает группу, где не выбрана НИ ОДНА запись", () => {
    const rows = [{ key: "r1", entries: [{ entryKey: "i1::dmg" }, { entryKey: "i2::dmg" }] }];
    expect(rowsNeedingExpansion(rows, new Set())).toEqual(new Set());
  });

  it("раскрывает группу, где выбрана только ЧАСТЬ записей (типично: конфликт вперемешку с чистыми)", () => {
    const rows = [{ key: "r1", entries: [{ entryKey: "i1::dmg" }, { entryKey: "i2::dmg" }, { entryKey: "i3::dmg" }] }];
    expect(rowsNeedingExpansion(rows, new Set(["i1::dmg"]))).toEqual(new Set(["r1"]));
  });

  it("обрабатывает несколько групп независимо", () => {
    const rows = [
      { key: "homogeneous", entries: [{ entryKey: "a::x" }, { entryKey: "b::x" }] },
      { key: "mixed", entries: [{ entryKey: "c::x" }, { entryKey: "d::x" }] }
    ];
    const selected = new Set(["a::x", "b::x", "c::x"]);
    expect(rowsNeedingExpansion(rows, selected)).toEqual(new Set(["mixed"]));
  });
});

// wdbc-5tz: _ensureReport() раньше заменял this.expanded целиком результатом
// rowsNeedingExpansion — «Обновить список»/«Применить» (оба сбрасывают
// this.report в null и просят полный ререндер, см. тесты [data-act=refresh]/
// [data-act=apply] выше) тем самым тихо схлопывали группы, которые ГМ уже
// раскрыл руками кликом (toggle-group/toggle-row). Починка — объединение
// множеств, не замена.
describe("_ensureReport: повторный прогон объединяет expanded, а не затирает (wdbc-5tz)", () => {
  const mixedReport = () => ({
    rows: [{ key: "mixed", entries: [{ entryKey: "c::x", status: "conflict" }, { entryKey: "d::x", status: "clean" }] }],
    unmatched: []
  });

  it("первый прогон разворачивает неоднородную группу как раньше", async () => {
    buildLiveSyncReport.mockResolvedValueOnce(mixedReport());
    const app = Object.create(ContentSyncApp.prototype);
    app.report = null;
    app.selected = new Set();
    app.expanded = new Set();

    await ContentSyncApp.prototype._ensureReport.call(app);

    expect(app.expanded.has("mixed")).toBe(true);
  });

  it("группа, раскрытая ГМом вручную (не по авто-правилу), переживает «Обновить список»", async () => {
    buildLiveSyncReport.mockResolvedValueOnce({
      rows: [{ key: "homogeneous", entries: [{ entryKey: "a::x", status: "clean" }, { entryKey: "b::x", status: "clean" }] }],
      unmatched: []
    });
    const app = Object.create(ContentSyncApp.prototype);
    app.report = null;
    app.selected = new Set();
    // Группа однородная (все clean) — rowsNeedingExpansion её бы не раскрыл,
    // но ГМ раскрыл кликом toggle-group ДО повторного прогона.
    app.expanded = new Set(["homogeneous"]);

    await ContentSyncApp.prototype._ensureReport.call(app);
    // report уже стоит (не null) — этот вызов no-op, expanded не трогается.
    expect(app.expanded.has("homogeneous")).toBe(true);

    // Симулируем «Обновить список»: report сбрасывается в null, второй прогон
    // должен ДОБАВИТЬ авто-раскрытие поверх, не заменить ручное раскрытие.
    buildLiveSyncReport.mockResolvedValueOnce(mixedReport());
    app.report = null;
    await ContentSyncApp.prototype._ensureReport.call(app);

    expect(app.expanded.has("homogeneous")).toBe(true); // ручное раскрытие цело
    expect(app.expanded.has("mixed")).toBe(true);        // новое авто-раскрытие тоже есть
  });
});
