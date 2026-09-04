// test/apps/scene-settings-v2.test.mjs
//
// SceneSettingsApp (wdbc-paif) — единое окно «Сцена», собирающее Окружение и
// Завесу в одну страницу вместо двух отдельных окон. Математика/разметка
// самих разделов не переписана и здесь не дублируется — она уже покрыта
// environment-v2.test.mjs и veil-v2.test.mjs. Эти тесты проверяют именно
// СОСТАВ: у каждого раздела своё, не общее, состояние (EnvironmentApp/
// VeilMystic переиспользуются как plain-object контроллеры, см. комментарий
// в module/apps/scene-settings.mjs про геттеры element/state у ApplicationV2),
// и клик в одном разделе не задевает флаги/данные другого — это и есть риск,
// от которого явно предостерегала задача wdbc-paif.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { SceneSettingsApp } from "../../module/apps/scene-settings.mjs";

// Завеса._navigators()/_ritualActors() читают game.actors на каждый _prepareContext.
globalThis.game.actors = Object.assign([], { get: () => null });

function stubScene(id = "sc1", name = "Тестовая сцена") {
  const flags = {};
  return {
    id, name,
    getFlag: (scope, key) => flags[key],
    setFlag: async (scope, key, v) => { flags[key] = v; },
    unsetFlag: async (scope, key) => { delete flags[key]; },
    _flags: flags
  };
}

describe("SceneSettingsApp: конструктор заводит два независимых контроллера", () => {
  it("env и veil начинают с формы состояния своего класса — разные объекты", () => {
    const app = new SceneSettingsApp();
    expect(app.env.uiState).toEqual({ cat: "weather", target: null });
    expect(app.veil.uiState).toEqual({ tab: "veil", navId: "", godPicker: false });
    expect(app.env.uiState).not.toBe(app.veil.uiState);
    // Поля Завесы (ritual/journey/tarot/defile) не просачиваются в Окружение и наоборот.
    expect(app.env.ritual).toBeUndefined();
    expect(app.veil.ritual).toBeTruthy();
    expect(app.veil.journey).toBeTruthy();
    expect(app.veil.tarot).toBeTruthy();
    expect(app.veil.defile).toBeTruthy();
  });

  it("оба контроллера несут методы своего класса как есть (не переписаны)", () => {
    const app = new SceneSettingsApp();
    expect(typeof app.env._prepareContext).toBe("function");
    expect(typeof app.env._patch).toBe("function");
    expect(typeof app.env._onRender).toBe("function");
    expect(typeof app.veil._prepareContext).toBe("function");
    expect(typeof app.veil._onRender).toBe("function");
    expect(typeof app.veil._castRitual).toBe("function");
  });
});

describe("_prepareContext: делегирует обоим разделам", () => {
  it("отдаёт env/veil контекст и флаг активной вкладки окна", async () => {
    game.user = { isGM: true };
    canvas.scene = null;
    game.scenes = { current: null };
    const app = new SceneSettingsApp();
    app.ssTab = "veil";
    const ctx = await SceneSettingsApp.prototype._prepareContext.call(app, {});
    expect(ctx.isGM).toBe(true);
    expect(ctx.isEnvTab).toBe(false);
    expect(ctx.isVeilTab).toBe(true);
    expect(ctx.env).toBeTruthy();
    expect(ctx.veil).toBeTruthy();
    // Контекст раздела Окружения не путается с контекстом Завесы.
    expect(ctx.env.isWeather).toBe(true);
    expect(ctx.veil.isVeil).toBe(true);
  });
});

describe("_onRender: переключатель вкладок и разводка разделов", () => {
  it("data-sstab переключает ssTab и перерисовывает окно", () => {
    game.user = { isGM: true };
    canvas.scene = null;
    game.scenes = { current: null };
    const app = new SceneSettingsApp();
    const handlers = {};
    app.element = listenerRoot({ "[data-sstab]": [{ dataset: { sstab: "veil" } }] }, handlers);
    let rendered = false;
    app.render = () => { rendered = true; };
    SceneSettingsApp.prototype._onRender.call(app, { env: {}, veil: {} }, {});
    handlers["[data-sstab]:click"]();
    expect(app.ssTab).toBe("veil");
    expect(rendered).toBe(true);
  });

  it("клик по Окружению пишет только флаг env сцены — Завеса не тронута", async () => {
    game.user = { isGM: true };
    const scene = stubScene();
    canvas.scene = scene;
    game.scenes = { current: null };
    const app = new SceneSettingsApp();
    app.env.uiState.target = "scene";
    const handlers = {};
    app.element = listenerRoot({ "[data-weather]": [{ dataset: { weather: "storm" } }] }, handlers);
    app.render = () => {};
    SceneSettingsApp.prototype._onRender.call(app, { env: {}, veil: {} }, {});
    await handlers["[data-weather]:click"]();
    expect(scene._flags.env?.weather).toBe("storm");
    expect(scene._flags.veil).toBeUndefined();
  });

  it("клик по Завесе (фактор) пишет только флаг veil сцены — Окружение не тронуто", async () => {
    game.user = { isGM: true };
    const scene = stubScene();
    canvas.scene = scene;
    game.scenes = { current: null };
    const app = new SceneSettingsApp();
    const handlers = {};
    app.element = listenerRoot({
      "[data-factor]": [{ dataset: { factor: "storm" } }]
    }, handlers);
    app.render = () => {};
    SceneSettingsApp.prototype._onRender.call(app, { env: {}, veil: {} }, {});
    await handlers["[data-factor]:change"]({ target: { checked: true } });
    expect(scene._flags.veil?.factors?.storm).toBe(true);
    expect(scene._flags.env).toBeUndefined();
  });
});
