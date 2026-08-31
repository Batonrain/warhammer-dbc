// test/regions/scene-live-recalc.test.mjs
//
// Общий регистратор «живой пересчёт по сцене» (Ауры + Рунические Вязи).
// Hooks.on в foundry-stub.mjs — no-op, поэтому сама диспетчерская логика
// (какие поля токена триггерят пересчёт, чей itemWatch-фильтр применяется
// к какому хуку) раньше нигде не проверялась. Тут её ловим, подменяя
// Hooks.on локальным перехватчиком, который копит колбэки по имени хука.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { registerSceneLiveRecalc } from "../../module/regions/scene-live-recalc.mjs";

let handlers;
beforeEach(() => {
  handlers = {};
  globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
  globalThis.canvas = { scene: { id: "scene-1" } };
});

function fire(name, ...args) {
  for (const fn of handlers[name] || []) fn(...args);
}

describe("registerSceneLiveRecalc", () => {
  it("canvasReady/createToken/deleteToken всегда зовут recalc по сцене токена", () => {
    const calls = [];
    registerSceneLiveRecalc({ recalc: scene => calls.push(scene), tokenFields: ["x"] });

    fire("canvasReady");
    fire("createToken", { parent: "scene-A" });
    fire("deleteToken", { parent: "scene-B" });

    expect(calls).toEqual([canvas.scene, "scene-A", "scene-B"]);
  });

  it("updateToken зовёт recalc только если изменилось одно из tokenFields", () => {
    const calls = [];
    registerSceneLiveRecalc({ recalc: scene => calls.push(scene), tokenFields: ["x", "y"] });

    fire("updateToken", { parent: "scene-A" }, { rotation: 90 });
    expect(calls).toEqual([]);

    fire("updateToken", { parent: "scene-A" }, { x: 10 });
    expect(calls).toEqual(["scene-A"]);
  });

  it("onDeleteToken зовётся ДО recalc, но не подменяет его", () => {
    const order = [];
    registerSceneLiveRecalc({
      recalc: () => order.push("recalc"),
      tokenFields: ["x"],
      onDeleteToken: () => order.push("onDeleteToken"),
    });

    fire("deleteToken", { parent: "scene-A" });
    expect(order).toEqual(["onDeleteToken", "recalc"]);
  });

  it("без itemWatch createItem/deleteItem/updateItem не регистрируются", () => {
    registerSceneLiveRecalc({ recalc: () => {}, tokenFields: ["x"] });
    expect(handlers.createItem).toBeUndefined();
    expect(handlers.deleteItem).toBeUndefined();
    expect(handlers.updateItem).toBeUndefined();
  });

  it("itemWatch.filter гейтит createItem/deleteItem, но не updateItem", () => {
    const calls = [];
    registerSceneLiveRecalc({
      recalc: () => calls.push("recalc"),
      tokenFields: ["x"],
      itemWatch: { fields: ["system.active"], filter: item => !item.excluded },
    });

    fire("createItem", { actor: {}, excluded: true });
    expect(calls).toEqual([]);
    fire("createItem", { actor: {}, excluded: false });
    expect(calls).toEqual(["recalc"]);

    fire("deleteItem", { actor: {}, excluded: true });
    expect(calls).toEqual(["recalc"]);

    // updateItem игнорирует filter — только item.actor + перечисленные поля.
    fire("updateItem", { actor: {}, excluded: true }, { "system.active": true });
    expect(calls).toEqual(["recalc", "recalc"]);
  });

  it("itemWatch: и createItem/deleteItem, и updateItem требуют item.actor", () => {
    const calls = [];
    registerSceneLiveRecalc({
      recalc: () => calls.push("recalc"),
      tokenFields: ["x"],
      itemWatch: { fields: ["system.active"] },
    });

    fire("createItem", { actor: null });
    fire("updateItem", { actor: null }, { "system.active": true });
    expect(calls).toEqual([]);
  });

  it("updateItem зовёт recalc только если задето одно из полей (вкл. вложенные)", () => {
    const calls = [];
    registerSceneLiveRecalc({
      recalc: () => calls.push("recalc"),
      tokenFields: ["x"],
      itemWatch: { fields: ["system.equipped"] },
    });

    fire("updateItem", { actor: {} }, { "system.name": "x" });
    expect(calls).toEqual([]);

    fire("updateItem", { actor: {} }, { system: { equipped: true } });
    expect(calls).toEqual(["recalc"]);
  });

  it("regionBehavior:true регистрирует create/update/deleteRegionBehavior на recalc(scene)", () => {
    const calls = [];
    registerSceneLiveRecalc({ recalc: scene => calls.push(scene), tokenFields: ["x"], regionBehavior: true });

    fire("createRegionBehavior");
    fire("updateRegionBehavior");
    fire("deleteRegionBehavior");
    expect(calls).toEqual([canvas.scene, canvas.scene, canvas.scene]);
  });

  it("без regionBehavior эти хуки не регистрируются", () => {
    registerSceneLiveRecalc({ recalc: () => {}, tokenFields: ["x"] });
    expect(handlers.createRegionBehavior).toBeUndefined();
  });
});
