// test/apps/environment-v2.test.mjs
//
// EnvironmentApp — standalone-окно module/apps, переведённое на ApplicationV2
// (wdbc-x66t.4, по образцу RigManager, wdbc-x66t.1). Рендера здесь нет —
// Foundry в тестах не запускается, — проверяется договор с шаблоном (общий
// describeV2Sheet) и разводка _prepareContext/_onRender на узкий набор кнопок.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { EnvironmentApp } from "../../module/apps/environment.mjs";
import { defaultEnv } from "../../module/constants/environment.mjs";

describeV2Sheet(EnvironmentApp, {
  sheet: "module/apps/environment.mjs",
  template: "templates/apps/environment.hbs"
});

function stubScene(name, id = "sc1") {
  return {
    id, name,
    getFlag: () => undefined,
    setFlag: async () => {},
    unsetFlag: async () => {}
  };
}

/**
 * Одиночный узел для el.querySelector(...) — в отличие от querySelectorAll,
 * listenerRoot отдаёт его «как есть», без обёртки addEventListener, поэтому
 * узел носит свой addEventListener, который сам пишет в общий handlers.
 */
function single(handlers, selector) {
  return { dataset: {}, addEventListener: (evt, fn) => { handlers[`${selector}:${evt}`] = fn; } };
}

function appLike(nodesFactory = () => ({})) {
  const handlers = {};
  const nodes = nodesFactory(handlers);
  const app = Object.create(EnvironmentApp.prototype);
  app.state = { cat: "weather", target: null };
  app.render = () => {};
  app.element = listenerRoot(nodes, handlers);
  return app;
}

describe("_prepareContext", () => {
  it("без активной сцены отдаёт заглушку имени и окружение по умолчанию", async () => {
    game.user = { isGM: false };
    canvas.scene = null;
    game.scenes = { current: null };
    const app = appLike();
    const ctx = await EnvironmentApp.prototype._prepareContext.call(app, {});
    expect(ctx.sceneName).toBe("— нет активной сцены —");
    expect(ctx.isGM).toBe(false);
    expect(ctx.inGroup).toBe(false);
    expect(ctx.isWeather).toBe(true);
    expect(ctx.env.raw).toEqual(defaultEnv());
  });

  it("с активной сценой без группы показывает её имя и текущую категорию", async () => {
    game.user = { isGM: true };
    canvas.scene = stubScene("Мостик «Алого Слова»");
    game.scenes = { current: null };
    const app = appLike();
    app.state = { cat: "rad", target: null };
    const ctx = await EnvironmentApp.prototype._prepareContext.call(app, {});
    expect(ctx.sceneName).toBe("Мостик «Алого Слова»");
    expect(ctx.isGM).toBe(true);
    expect(ctx.isRad).toBe(true);
    expect(ctx.isTargetScene).toBe(true);
  });
});

describe("_onRender: разводка кнопок", () => {
  it("data-cat переключает категорию и перерисовывает окно", () => {
    game.user = { isGM: false };
    const app = appLike(() => ({ "[data-cat]": [{ dataset: { cat: "gravity" } }] }));
    let rendered = false;
    app.render = () => { rendered = true; };
    EnvironmentApp.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-cat]:click"]();
    expect(app.state.cat).toBe("gravity");
    expect(rendered).toBe(true);
  });

  it("игроку (не ГМ) не вешает редактирование — data-weather не регистрируется", () => {
    game.user = { isGM: false };
    const app = appLike(() => ({ "[data-weather]": [{ dataset: { weather: "storm" } }] }));
    EnvironmentApp.prototype._onRender.call(app, {}, {});
    expect(app.element.handlers["[data-weather]:click"]).toBeUndefined();
  });

  it("ГМу data-weather зовёт _patch с ключом погоды и сбросом своего текста", () => {
    game.user = { isGM: true };
    const app = appLike(() => ({ "[data-weather]": [{ dataset: { weather: "storm" } }] }));
    const calls = [];
    app._patch = p => calls.push(p);
    EnvironmentApp.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-weather]:click"]();
    expect(calls).toEqual([{ weather: "storm", weatherText: "" }]);
  });

  it("data-act=reset зовёт _patch(defaultEnv())", () => {
    game.user = { isGM: true };
    const app = appLike(h => ({ "[data-act=reset]": [single(h, "[data-act=reset]")] }));
    const calls = [];
    app._patch = p => calls.push(p);
    EnvironmentApp.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-act=reset]:click"]();
    expect(calls).toEqual([defaultEnv()]);
  });
});
