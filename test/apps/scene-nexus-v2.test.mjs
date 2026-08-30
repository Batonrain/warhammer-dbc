// test/apps/scene-nexus-v2.test.mjs
//
// SceneNexus — standalone-окно module/apps, переведённое на ApplicationV2
// (wdbc-x66t.5, по образцу RigManager, wdbc-x66t.1). Рендера здесь нет —
// Foundry в тестах не запускается, — проверяется договор с шаблоном (общий
// describeV2Sheet) и разводка _onRender на узкий набор кнопок.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { SceneNexus } from "../../module/apps/scene-nexus.mjs";

describeV2Sheet(SceneNexus, {
  sheet: "module/apps/scene-nexus.mjs",
  template: "templates/apps/scene-nexus.hbs"
});

function appLike(nodes = {}, collapsed = {}) {
  const handlers = {};
  const app = Object.create(SceneNexus.prototype);
  app._collapsed = collapsed;
  app._saveCollapsed = () => {};
  app._syncTransitionPerms = () => {};
  app.element = listenerRoot(nodes, handlers);
  app.render = () => {};
  return app;
}

describe("_prepareContext", () => {
  it("не падает без выбранной сцены и без групп (базовая форма контекста)", async () => {
    game.user = { isGM: true };
    game.scenes = { current: null, active: null, [Symbol.iterator]: function* () {} };
    canvas.scene = null;
    canvas.tokens = { controlled: [] };
    const app = appLike();
    const ctx = await SceneNexus.prototype._prepareContext.call(app, {});
    expect(ctx.isGM).toBe(true);
    expect(ctx.hasGroups).toBe(false);
    expect(ctx.hasSel).toBe(false);
    expect(ctx.curName).toBe("— нет активной сцены —");
  });
});

describe("_onRender: разводка кнопок (игрок)", () => {
  it("data-jump зовёт requestTeleport с id сцены, минуя клик по data-card-tool", () => {
    game.user = { isGM: false };
    const app = appLike({ "[data-jump]": [{ dataset: { jump: "sc1" }, closest: () => null }] });
    const calls = [];
    app.requestTeleport = id => calls.push(id);
    SceneNexus.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-jump]:click"]({ target: { closest: () => null } });
    expect(calls).toEqual(["sc1"]);
  });

  it("data-peek зовёт peekScene с id сцены и не всплывает к data-jump", () => {
    game.user = { isGM: false };
    const app = appLike({ "[data-peek]": [{ dataset: { peek: "sc2" } }] });
    const calls = [];
    app.peekScene = id => calls.push(id);
    SceneNexus.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-peek]:click"]({ stopPropagation: () => {} });
    expect(calls).toEqual(["sc2"]);
  });

  it("data-gcollapse переключает свёрнутость группы", () => {
    game.user = { isGM: false };
    const app = appLike({ "[data-gcollapse]": [{ dataset: { gcollapse: "g1" } }] });
    SceneNexus.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-gcollapse]:click"]({ stopPropagation: () => {} });
    expect(app._collapsed.g1).toBe(true);
  });

  it("игроку (не ГМ) не вешает управление ГМа — data-toggleopen ничего не даёт", () => {
    game.user = { isGM: false };
    const app = appLike({ "[data-toggleopen]": [{ dataset: { toggleopen: "sc3" } }] });
    app._toggleOpen = () => { throw new Error("не должно вызываться у игрока"); };
    expect(() => SceneNexus.prototype._onRender.call(app, {}, {})).not.toThrow();
    // Без ГМ-ветки обработчик на data-toggleopen не регистрируется вовсе.
    expect(app.element.handlers["[data-toggleopen]:click"]).toBeUndefined();
  });
});

describe("_onRender: разводка кнопок (ГМ)", () => {
  it("data-toggleopen зовёт _toggleOpen с id сцены", () => {
    game.user = { isGM: true };
    // GM-ветка _onRender синхронно разводит подсказки карточек через
    // game.scenes.get(...) — заглушке нужен этот метод, иначе крах ещё
    // до регистрации кнопок управления.
    game.scenes = { get: () => null };
    const app = appLike({ "[data-toggleopen]": [{ dataset: { toggleopen: "sc4" } }] });
    const calls = [];
    app._toggleOpen = id => calls.push(id);
    SceneNexus.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-toggleopen]:click"]({ stopPropagation: () => {} });
    expect(calls).toEqual(["sc4"]);
  });
});
