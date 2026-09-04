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
import { listenerRoot, captured, fakeForm } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { CogitatorManager, CogitatorConsole, AUTO_OPEN_FLAG } from "../../module/apps/cogitator.mjs";

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

// wdbc-4hyt (подвопрос 1): текст страницы должен проходить через стандартный
// enrichHTML Foundry, чтобы @UUID[Actor.xxx]{Имя} стал кликабельной ссылкой на
// Журнал/Актора, — без порчи уже рабочего мини-языка навигации ([1]/[0]-токены,
// 【…】-маркеры). Символы не пересекаются: подробности — в комментарии над
// renderBody в module/apps/cogitator.mjs.
describe("CogitatorConsole._prepareContext (просмотр): enrichHTML + [1]-токены", () => {
  it("прогоняет тело через enrichHTML, оставляя нетронутым cog-link токен [1]", async () => {
    const savedUser = game.user;
    const savedEnrich = foundry.applications.ux.TextEditor.implementation.enrichHTML;
    const enrichCalls = [];
    foundry.applications.ux.TextEditor.implementation.enrichHTML = async (html, opts) => {
      enrichCalls.push({ html, opts });
      // Имитация реального enrichHTML: @UUID[...]{Имя} → ссылка на документ.
      return html.replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g,
        (m, uuid, name) => `<a class="content-link" data-uuid="${uuid}">${name || uuid}</a>`);
    };
    try {
      game.user = { isGM: true, id: "gm1" };
      const cog = {
        title: "Т", clickableTokens: true, startPage: "p1", theme: {},
        binaryAccess: { techpriest: false, users: [] },
        pages: [{
          id: "p1", name: "Главная",
          body: "Досье: @UUID[Actor.abc123]{Инквизитор Ксеркс}\nПерейти: [1]",
          links: [{ token: "[1]", command: "", target: "p2" }],
          entries: {}
        }]
      };
      const j = fakeJournal(cog);
      const app = consoleLike(j);
      app.mode = "view"; app.currentPageId = null; app.asPlayer = false;

      const ctx = await CogitatorConsole.prototype._prepareContext.call(app, {});

      // @UUID превратился в контент-ссылку через enrichHTML...
      expect(ctx.bodyHtml).toContain('<a class="content-link" data-uuid="Actor.abc123">Инквизитор Ксеркс</a>');
      // ...а собственный кликабельный токен [1] остался нашей cog-link-ссылкой,
      // enrichHTML не подменил и не съел его как часть своего синтаксиса.
      expect(ctx.bodyHtml).toContain('<a class="cog-link" data-target="p2">[1]</a>');
      // enrichHTML вызван один раз, привязан к журналу, secrets — по правам ГМ.
      expect(enrichCalls).toHaveLength(1);
      expect(enrichCalls[0].opts).toEqual({ relativeTo: j, secrets: true });
    } finally {
      game.user = savedUser;
      foundry.applications.ux.TextEditor.implementation.enrichHTML = savedEnrich;
    }
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
        { id: "jr", title: "Корневой", pages: 1, playerAccess: false, folderId: "root1", autoOpenSceneName: "" }
      ]);
      expect(subGroup.rows).toEqual([
        { id: "js", title: "Альфа-1", pages: 2, playerAccess: true, folderId: "sub1", autoOpenSceneName: "" }
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

// wdbc-4hyt (подвопрос 2): привязка когитатор → сцена, флаг Scene.autoOpenCogitator.
// Сама разводка хука canvasReady — test/apps/cogitator-autoopen.test.mjs; здесь —
// сторона Менеджера, которая этот флаг выставляет/снимает.

/** Сцена-заглушка: getFlag отдаёт заданный autoOpenCogitator, set/unsetFlag копят вызовы. */
function fakeScene(id, name, flagValue) {
  const calls = { setFlag: [], unsetFlag: 0 };
  return {
    id, name, calls,
    getFlag: (ns, key) => (ns === "warhammer-dbc" && key === AUTO_OPEN_FLAG) ? flagValue : undefined,
    setFlag: async (ns, key, value) => { calls.setFlag.push(value); },
    unsetFlag: async () => { calls.unsetFlag++; }
  };
}

describe("CogitatorManager._prepareContext: autoOpenSceneName", () => {
  it("показывает имя сцены, у которой флаг указывает на этот когитатор", async () => {
    const savedUser = game.user, savedFolders = game.folders, savedJournal = game.journal,
          savedCONST = globalThis.CONST, savedScenes = game.scenes;
    try {
      globalThis.CONST = { ...globalThis.CONST, DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
      game.user = { isGM: true, id: "gm1" };
      const root = { id: "root1", type: "JournalEntry", folder: null, name: "КОГИТАТОРЫ", getFlag: (ns, key) => key === "cogRoot" ? true : null };
      game.folders = [root];
      const j = { id: "j1", name: "Когитатор: Терминал", folder: { id: "root1" }, ownership: { default: 0 },
        getFlag: (ns, key) => key === "cogitator" ? { title: "Терминал", pages: [] } : null,
        testUserPermission: () => true };
      const list = [j]; list.get = id => list.find(x => x.id === id) ?? null;
      game.journal = list;
      game.scenes = [fakeScene("s1", "Ангар", { journalId: "j1", includeGm: false })];

      const app = Object.create(CogitatorManager.prototype);
      const ctx = await CogitatorManager.prototype._prepareContext.call(app, {});
      const row = ctx.groups.find(g => g.id === "root1").rows[0];
      expect(row.autoOpenSceneName).toBe("Ангар");
    } finally {
      game.user = savedUser; game.folders = savedFolders; game.journal = savedJournal;
      globalThis.CONST = savedCONST; game.scenes = savedScenes;
    }
  });
});

describe("CogitatorManager._autoOpenDialog", () => {
  it("привязывает когитатор к выбранной сцене и снимает флаг со старой", async () => {
    const savedScenes = game.scenes;
    try {
      const oldBound = fakeScene("s-old", "Старая", { journalId: "j1", includeGm: false });
      const target = fakeScene("s-new", "Новая", undefined);
      const scenes = [oldBound, target];
      scenes.get = id => scenes.find(s => s.id === id) ?? null;
      game.scenes = scenes;

      const app = Object.create(CogitatorManager.prototype);
      const done = app._autoOpenDialog("j1");
      expect(captured.dialog.title).toBe("Автооткрытие на сцене");
      await captured.dialog.buttons.ok.callback(fakeForm({ "[name=scene]": "s-new", "[name=includegm]": true }));
      await done;

      expect(oldBound.calls.unsetFlag).toBe(1);
      expect(target.calls.setFlag).toEqual([{ journalId: "j1", includeGm: true }]);
    } finally { game.scenes = savedScenes; }
  });

  it("«— не открывать —» снимает привязку и ничего не ставит", async () => {
    const savedScenes = game.scenes;
    try {
      const oldBound = fakeScene("s-old", "Старая", { journalId: "j1", includeGm: false });
      const scenes = [oldBound];
      scenes.get = id => scenes.find(s => s.id === id) ?? null;
      game.scenes = scenes;

      const app = Object.create(CogitatorManager.prototype);
      const done = app._autoOpenDialog("j1");
      await captured.dialog.buttons.ok.callback(fakeForm({ "[name=scene]": "", "[name=includegm]": false }));
      await done;

      expect(oldBound.calls.unsetFlag).toBe(1);
      expect(oldBound.calls.setFlag).toEqual([]);
    } finally { game.scenes = savedScenes; }
  });

  it("отмена ничего не меняет", async () => {
    const savedScenes = game.scenes;
    try {
      const oldBound = fakeScene("s-old", "Старая", { journalId: "j1", includeGm: false });
      const scenes = [oldBound];
      scenes.get = id => scenes.find(s => s.id === id) ?? null;
      game.scenes = scenes;

      const app = Object.create(CogitatorManager.prototype);
      const done = app._autoOpenDialog("j1");
      captured.dialog.buttons.cancel.callback();
      await done;

      expect(oldBound.calls.unsetFlag).toBe(0);
      expect(oldBound.calls.setFlag).toEqual([]);
    } finally { game.scenes = savedScenes; }
  });
});
