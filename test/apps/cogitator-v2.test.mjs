// test/apps/cogitator-v2.test.mjs
//
// Когитаторы — второй эпик wdbc-x66t.7 перевода standalone-окон module/apps на
// ApplicationV2 (образец — module/apps/rig-manager.mjs, wdbc-x66t.1). Файл несёт
// ДВА независимых класса: CogitatorManager (список записей) и CogitatorConsole
// (сама запись — просмотр/правка). Рендера здесь нет — Foundry в тестах не
// запускается, — проверяется договор с шаблоном (общий describeV2Sheet) и
// разводка _onRender/_prepareContext по обоим классам.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { CogitatorManager, CogitatorConsole } from "../../module/apps/cogitator.mjs";

describeV2Sheet(CogitatorManager, {
  sheet: "module/apps/cogitator.mjs",
  template: "templates/apps/cogitator-manager.hbs"
});
describeV2Sheet(CogitatorConsole, {
  sheet: "module/apps/cogitator.mjs",
  template: "templates/apps/cogitator.hbs"
});

// ── CogitatorConsole ────────────────────────────────────────────────────────

/** Лист без Foundry: прототип + подставной journalId/journal-геттер. */
function consoleLike(journal, nodes = {}) {
  const handlers = {};
  const app = Object.create(CogitatorConsole.prototype);
  app.journalId = journal?.id ?? "missing";
  Object.defineProperty(app, "journal", { get: () => journal ?? null });
  app.mode = "view";
  app.currentPageId = null;
  app.selectedPageId = null;
  app.draft = null;
  app.cmdMsg = "";
  app.asPlayer = false;
  app.element = listenerRoot(nodes, handlers);
  app.render = () => {};
  return app;
}

function fakeJournal(cog) {
  return {
    id: "j1", name: "Когитатор: Тест",
    getFlag: (ns, key) => (ns === "warhammer-dbc" && key === "cogitator") ? cog : null
  };
}

describe("CogitatorConsole._prepareContext", () => {
  it("сигнализирует отсутствие журнала", async () => {
    const app = consoleLike(null);
    expect(await CogitatorConsole.prototype._prepareContext.call(app, {})).toEqual({ missing: true });
  });
});

describe("CogitatorConsole.title", () => {
  it("берёт заголовок когитатора и суффикс режима правки", () => {
    const j = fakeJournal({ title: "Терминал Инквизитора" });
    const app = consoleLike(j);
    expect(Object.getOwnPropertyDescriptor(CogitatorConsole.prototype, "title").get.call(app)).toBe("Терминал Инквизитора");
    app.mode = "edit";
    expect(Object.getOwnPropertyDescriptor(CogitatorConsole.prototype, "title").get.call(app)).toBe("Терминал Инквизитора — правка");
  });

  it("выдаёт запасной заголовок, если во флаге нет когитатора", () => {
    const app = consoleLike(fakeJournal(null));
    expect(Object.getOwnPropertyDescriptor(CogitatorConsole.prototype, "title").get.call(app)).toBe("Когитатор");
  });
});

describe("CogitatorConsole: заголовок окна (window.controls)", () => {
  it("toggleEdit из просмотра запускает черновик правки", () => {
    const app = consoleLike(fakeJournal({ title: "Т" }));
    const calls = [];
    app._initDraft = () => calls.push("init");
    let rendered = false;
    app.render = () => { rendered = true; };
    CogitatorConsole.DEFAULT_OPTIONS.actions.toggleEdit.call(app);
    expect(calls).toEqual(["init"]);
    expect(rendered).toBe(true);
  });

  it("toggleEdit из правки сбрасывает черновик и возвращает в просмотр", () => {
    const app = consoleLike(fakeJournal({ title: "Т" }));
    app.mode = "edit";
    app.draft = { title: "черновик" };
    app.currentPageId = "p1";
    let rendered = false;
    app.render = () => { rendered = true; };
    CogitatorConsole.DEFAULT_OPTIONS.actions.toggleEdit.call(app);
    expect(app.mode).toBe("view");
    expect(app.draft).toBeNull();
    expect(app.currentPageId).toBeNull();
    expect(rendered).toBe(true);
  });

  it("togglePlayerView переключает asPlayer и выходит из правки", () => {
    const app = consoleLike(fakeJournal({ title: "Т" }));
    app.mode = "edit";
    app.draft = { title: "черновик" };
    let rendered = false;
    app.render = () => { rendered = true; };
    CogitatorConsole.DEFAULT_OPTIONS.actions.togglePlayerView.call(app);
    expect(app.asPlayer).toBe(true);
    expect(app.mode).toBe("view");
    expect(app.draft).toBeNull();
    expect(rendered).toBe(true);
    CogitatorConsole.DEFAULT_OPTIONS.actions.togglePlayerView.call(app);
    expect(app.asPlayer).toBe(false);
  });
});

describe("CogitatorConsole._onRender: навигация просмотра", () => {
  it("[data-act=back] возвращает на стартовую страницу когитатора", () => {
    // el.querySelector (в отличие от querySelectorAll) в listenerRoot отдаёт
    // узел из nodes КАК ЕСТЬ, без обёртки addEventListener — подставляем его сами.
    const backBtn = { dataset: {}, addEventListener: (event, fn) => { backBtn._onClick = fn; } };
    const j = fakeJournal({ title: "Т", startPage: "p-start" });
    const app = consoleLike(j, { "[data-act=back]": [backBtn] });
    app.currentPageId = "p-other";
    app.cmdMsg = "> старое сообщение";
    let rendered = false;
    app.render = () => { rendered = true; };
    try {
      // Режим просмотра всегда заводит таймер скрапкода (listenerRoot отдаёт
      // хотя бы один узел на любой селектор, включая .cog-scrapcode[data-len]) —
      // подчищаем его сами, иначе setInterval уйдёт живым из теста.
      CogitatorConsole.prototype._onRender.call(app, {}, {});
      backBtn._onClick();
      expect(app.currentPageId).toBe("p-start");
      expect(app.cmdMsg).toBe("");
      expect(rendered).toBe(true);
    } finally {
      app._stopScrap();
    }
  });
});

// ── CogitatorManager ────────────────────────────────────────────────────────

describe("CogitatorManager._prepareContext", () => {
  it("группирует когитаторы по корню/подпапкам и считает страницы", async () => {
    const savedUser = game.user, savedFolders = game.folders, savedJournal = game.journal, savedCONST = globalThis.CONST;
    try {
      globalThis.CONST = { ...globalThis.CONST, DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
      game.user = { isGM: true, id: "gm1" };

      const root = { id: "root1", type: "JournalEntry", folder: null, name: "КОГИТАТОРЫ",
        getFlag: (ns, key) => key === "cogRoot" ? true : null };
      const sub = { id: "sub1", type: "JournalEntry", folder: { id: "root1" }, name: "Альфа",
        getFlag: () => null };
      game.folders = [root, sub];

      const rootCog = { id: "jr", name: "Когитатор: Корневой", folder: { id: "root1" }, ownership: { default: 0 },
        getFlag: (ns, key) => (key === "cogitator") ? { title: "Корневой", pages: [{ id: "p1" }] } : null,
        testUserPermission: () => true };
      const subCog = { id: "js", name: "Когитатор: Альфа-1", folder: { id: "sub1" }, ownership: { default: 2 },
        getFlag: (ns, key) => (key === "cogitator") ? { title: "Альфа-1", pages: [{ id: "p1" }, { id: "p2" }] } : null,
        testUserPermission: () => true };
      const notCog = { id: "jn", folder: { id: "root1" }, ownership: {}, getFlag: () => null, testUserPermission: () => true };
      const list = [rootCog, subCog, notCog];
      list.get = id => list.find(j => j.id === id) ?? null;
      game.journal = list;

      const app = Object.create(CogitatorManager.prototype);
      const ctx = await CogitatorManager.prototype._prepareContext.call(app, {});

      expect(ctx.isGM).toBe(true);
      expect(ctx.hasRoot).toBe(true);
      const rootGroup = ctx.groups.find(g => g.id === "root1");
      const subGroup = ctx.groups.find(g => g.id === "sub1");
      expect(rootGroup.rows).toEqual([
        { id: "jr", title: "Корневой", pages: 1, playerAccess: false, folderId: "root1" }
      ]);
      expect(subGroup.rows).toEqual([
        { id: "js", title: "Альфа-1", pages: 2, playerAccess: true, folderId: "sub1" }
      ]);
    } finally {
      game.user = savedUser; game.folders = savedFolders; game.journal = savedJournal; globalThis.CONST = savedCONST;
    }
  });
});

describe("CogitatorManager._onRender: разводка кнопок списка", () => {
  it("[data-open] открывает консоль в режиме просмотра", () => {
    const savedJournal = game.journal;
    try {
      const j = { id: "j1" };
      const list = [j]; list.get = id => list.find(x => x.id === id) ?? null;
      game.journal = list;

      const app = Object.create(CogitatorManager.prototype);
      const handlers = {};
      app.element = listenerRoot({ "[data-open]": [{ dataset: { open: "j1" } }] }, handlers);
      CogitatorManager.prototype._onRender.call(app, {}, {});
      // openCogitator (module-level) рендерит настоящую CogitatorConsole — здесь
      // достаточно убедиться, что обработчик существует и не падает при вызове.
      expect(() => handlers["[data-open]:click"]()).not.toThrow();
    } finally {
      game.journal = savedJournal;
    }
  });
});
