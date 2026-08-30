// test/apps/systems-overview-v2.test.mjs
//
// StarSystemsOverview — часть эпика wdbc-x66t (wdbc-x66t.8) перевода
// standalone-окон module/apps на ApplicationV2 (образец — module/apps/rig-manager.mjs,
// wdbc-x66t.1). Отличие от прочих окон — старая декларативная система вкладок V1
// (tabs: [{navSelector, contentSelector, initial}]), заменённая на static TABS +
// action tab: onTab (по образцу module/sheets/horde-sheet.mjs). Рендера здесь
// нет — Foundry в тестах не запускается, — проверяется договор с шаблоном
// (общий describeV2Sheet: он же ловит рассинхрон вкладок класса и разметки) и
// разводка _prepareContext/_onRender на узкий набор случаев.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { StarSystemsOverview } from "../../module/apps/systems-overview.mjs";

describeV2Sheet(StarSystemsOverview, {
  sheet: "module/apps/systems-overview.mjs",
  template: "templates/apps/systems-overview.hbs"
});

/** Окно без Foundry: прототип + подставной корень листа. */
function appLike(nodes = {}) {
  const handlers = {};
  const app = Object.create(StarSystemsOverview.prototype);
  app.element = listenerRoot(nodes, handlers);
  app.render = () => {};
  return app;
}

describe("StarSystemsOverview._prepareContext", () => {
  it("без систем и без прав Вольного Торговца — пустой базовый контекст, вкладка по умолчанию", async () => {
    const savedUser = game.user, savedActors = game.actors;
    try {
      game.user = { isGM: false };
      game.actors = [];
      const app = appLike();
      const ctx = await StarSystemsOverview.prototype._prepareContext.call(app, {});
      expect(ctx.isGM).toBe(false);
      expect(ctx.canManage).toBe(false);
      expect(ctx.hasSystems).toBe(false);
      expect(ctx.hasProt).toBe(false);
      expect(ctx.tab).toBe("protectorate");
    } finally {
      game.user = savedUser; game.actors = savedActors;
    }
  });

  it("вкладка контекста берётся из this.tabGroups.primary (native ApplicationV2), а не из старого V1 initial", async () => {
    const savedUser = game.user, savedActors = game.actors;
    try {
      game.user = { isGM: true };
      game.actors = [];
      const app = appLike();
      app.tabGroups = { primary: "systems" };
      const ctx = await StarSystemsOverview.prototype._prepareContext.call(app, {});
      expect(ctx.tab).toBe("systems");
      expect(ctx.isGM).toBe(true);
    } finally {
      game.user = savedUser; game.actors = savedActors;
    }
  });
});

describe("StarSystemsOverview._onRender: разводка кнопок", () => {
  it("[data-open-system] открывает лист системы независимо от прав (не только у ГМа)", () => {
    const savedUser = game.user, savedActors = game.actors;
    try {
      game.user = { isGM: false };
      const rendered = [];
      const actor = { id: "sys1", sheet: { render: v => rendered.push(v) } };
      const actors = [actor];
      actors.get = id => actors.find(a => a.id === id) ?? null;
      game.actors = actors;

      const app = appLike({ "[data-open-system]": [{ dataset: { openSystem: "sys1" } }] });
      StarSystemsOverview.prototype._onRender.call(app, {}, {});
      app.element.handlers["[data-open-system]:click"]();
      expect(rendered).toEqual([true]);
    } finally {
      game.user = savedUser; game.actors = savedActors;
    }
  });

  it("ПКМ по планете доступно ГМу, а игроку без Вольного Торговца — нет", () => {
    const savedUser = game.user, savedActors = game.actors;
    try {
      game.actors = [];

      game.user = { isGM: false };
      const appPlayer = appLike({ "[data-planet]": [{ dataset: { actor: "a1", planet: "p1" } }] });
      StarSystemsOverview.prototype._onRender.call(appPlayer, {}, {});
      expect(appPlayer.element.handlers["[data-planet]:contextmenu"]).toBeUndefined();

      game.user = { isGM: true };
      const appGM = appLike({ "[data-planet]": [{ dataset: { actor: "a1", planet: "p1" } }] });
      const menuCalls = [];
      appGM._planetMenu = (ev, actorId, itemId) => menuCalls.push([actorId, itemId]);
      StarSystemsOverview.prototype._onRender.call(appGM, {}, {});
      appGM.element.handlers["[data-planet]:contextmenu"]({ preventDefault: () => {} });
      expect(menuCalls).toEqual([["a1", "p1"]]);
    } finally {
      game.user = savedUser; game.actors = savedActors;
    }
  });

  it("[data-toggle-disc] (ГМ) открывает систему игрокам и обновляет ownership/discovered", async () => {
    const savedUser = game.user, savedActors = game.actors, savedCONST = globalThis.CONST;
    try {
      globalThis.CONST = { ...globalThis.CONST, DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
      game.user = { isGM: true };
      const updates = [];
      const actor = { id: "s1", ownership: { default: 0 }, update: async u => { updates.push(u); } };
      const actors = [actor];
      actors.get = id => actors.find(a => a.id === id) ?? null;
      game.actors = actors;

      const app = appLike({ "[data-toggle-disc]": [{ dataset: { toggleDisc: "s1" } }] });
      StarSystemsOverview.prototype._onRender.call(app, {}, {});
      await app.element.handlers["[data-toggle-disc]:click"]();
      expect(updates).toEqual([{ "ownership.default": 2, "system.discovered": true }]);
    } finally {
      game.user = savedUser; game.actors = savedActors; globalThis.CONST = savedCONST;
    }
  });

  it("игроку (не ГМ) недоступно управление ГМа — [data-toggle-disc] не получает обработчик", () => {
    const savedUser = game.user, savedActors = game.actors;
    try {
      game.user = { isGM: false };
      game.actors = [];
      const app = appLike({ "[data-toggle-disc]": [{ dataset: { toggleDisc: "s1" } }] });
      expect(() => StarSystemsOverview.prototype._onRender.call(app, {}, {})).not.toThrow();
      expect(app.element.handlers["[data-toggle-disc]:click"]).toBeUndefined();
    } finally {
      game.user = savedUser; game.actors = savedActors;
    }
  });
});
