// test/apps/rig-manager-v2.test.mjs
//
// RigManager — первое standalone-окно module/apps, переведённое на
// ApplicationV2 (wdbc-x66t.1, образец для остальных девяти). Рендера здесь
// нет — Foundry в тестах не запускается, — проверяется договор с шаблоном
// (общий describeV2Sheet, как у листов wdbc-ff4.10) и разводка _onRender.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { RigManager } from "../../module/apps/rig-manager.mjs";

describeV2Sheet(RigManager, {
  sheet: "module/apps/rig-manager.mjs",
  template: "templates/apps/rig-manager.hbs"
});

function appLike(actor, nodes = {}) {
  const handlers = {};
  const app = Object.create(RigManager.prototype);
  app.actorId = actor?.id ?? null;
  Object.defineProperty(app, "actor", { get: () => actor });
  app.element = listenerRoot(nodes, handlers);
  app.render = () => {};
  return app;
}

describe("_prepareContext", () => {
  it("сигнализирует отсутствие актора", async () => {
    const app = appLike(null);
    expect(await RigManager.prototype._prepareContext.call(app, {})).toEqual({ missing: true });
  });
});

describe("_onRender: разводка кнопок", () => {
  it("data-slot-clear зовёт _clearSlot с id слота", () => {
    const app = appLike({ id: "a1" }, { "[data-slot-clear]": [{ dataset: { slotClear: "s1" } }] });
    const calls = [];
    app._clearSlot = id => calls.push(id);
    RigManager.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-slot-clear]:click"]();
    expect(calls).toEqual(["s1"]);
  });

  it("data-item-clear зовёт _unassign с id предмета", () => {
    const app = appLike({ id: "a1" }, { "[data-item-clear]": [{ dataset: { itemClear: "it1" } }] });
    const calls = [];
    app._unassign = id => calls.push(id);
    RigManager.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-item-clear]:click"]();
    expect(calls).toEqual(["it1"]);
  });

  it("data-slot-variant (change) зовёт _setVariant со значением выбора", () => {
    const app = appLike({ id: "a1" },
      { "[data-slot-variant]": [{ dataset: { slotVariant: "sl1" } }] });
    const calls = [];
    app._setVariant = (slot, variant) => calls.push([slot, variant]);
    RigManager.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-slot-variant]:change"]({ target: { value: "holster" } });
    expect(calls).toEqual([["sl1", "holster"]]);
  });
});
