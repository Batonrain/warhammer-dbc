// test/apps/surgeon-v2.test.mjs
//
// SurgeonWindow — окно Хирургеона module/apps, переведённое на ApplicationV2
// (wdbc-x66t.3, вслед за RigManager из wdbc-x66t.1). Рендера здесь нет —
// Foundry в тестах не запускается, — проверяется договор с шаблоном (общий
// describeV2Sheet, как у листов wdbc-ff4.10) и разводка _onRender/_prepareContext.
//
// ВАЖНО: класс НЕ переименован (осталось SurgeonWindow) — на его имя завязан
// module/sheets/tabs/healing.mjs через Hooks.once(`close${app.constructor.name}`);
// это поведение живёт только в реальном Foundry и здесь не проверяется.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot, captured } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { SurgeonWindow } from "../../module/apps/surgeon.mjs";

describeV2Sheet(SurgeonWindow, {
  sheet: "module/apps/surgeon.mjs",
  template: "templates/apps/surgeon.hbs"
});

function appLike(actor, nodes = {}) {
  const handlers = {};
  const app = Object.create(SurgeonWindow.prototype);
  app.actorId = actor?.id ?? null;
  Object.defineProperty(app, "actor", { get: () => actor });
  app.element = listenerRoot(nodes, handlers);
  app.render = () => {};
  return app;
}

describe("_prepareContext", () => {
  it("сигнализирует отсутствие актора", async () => {
    const app = appLike(null);
    expect(await SurgeonWindow.prototype._prepareContext.call(app, {})).toEqual({ missing: true });
  });
});

describe("_onRender: разводка кнопок", () => {
  it("data-remove зовёт unsetFlag и гасит Механику импланта", async () => {
    const calls = [];
    const item = {
      id: "impl1", name: "Тестимплант",
      effects: { contents: [] },   // syncItemEffectsDisabled читает item.effects.contents
      unsetFlag: async (...a) => calls.push(["unsetFlag", ...a]),
    };
    const actor = { id: "a1", items: { get: id => (id === "impl1" ? item : null) } };
    const app = appLike(actor, { "[data-remove]": [{ dataset: { remove: "impl1" } }] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    await app.element.handlers["[data-remove]:click"]();
    expect(calls).toEqual([["unsetFlag", "warhammer-dbc", "installed"]]);
  });

  it("data-side-btn переключает bodySide: пусто → сторона → снова пусто", async () => {
    let side;
    const item = {
      id: "impl1",
      getFlag: (ns, key) => (key === "bodySide" ? side : undefined),
      setFlag: async (ns, key, v) => { side = v; },
      unsetFlag: async () => { side = undefined; },
    };
    const actor = { id: "a1", items: { get: id => (id === "impl1" ? item : null) } };
    const app = appLike(actor, { "[data-side-btn]": [{ dataset: { item: "impl1", sideBtn: "left" } }] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    const click = app.element.handlers["[data-side-btn]:click"];

    await click();
    expect(side).toBe("left");
    await click();
    expect(side).toBeUndefined();
  });

  it("data-open открывает лист найденного предмета", () => {
    const rendered = [];
    const item = { id: "impl1", sheet: { render: v => rendered.push(v) } };
    const actor = { id: "a1", items: { get: id => (id === "impl1" ? item : null) } };
    const app = appLike(actor, { "[data-open]": [{ dataset: { open: "impl1" } }] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-open]:click"]();
    expect(rendered).toEqual([true]);
  });

  it("data-open молчит, если предмет не найден", () => {
    const actor = { id: "a1", items: { get: () => null } };
    const app = appLike(actor, { "[data-open]": [{ dataset: { open: "missing" } }] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    expect(() => app.element.handlers["[data-open]:click"]()).not.toThrow();
  });
});

// data-both — кнопка «⚭ Обе стороны» (wdbc-7yeh): один и тот же протез сразу
// на left+right одним действием, вместо двух прогонов select-а. Кейс "own"
// проверяем целиком (setFlag/createEmbeddedDocuments — обычные mock-функции);
// кейс "lib" — только форму вызова createEmbeddedDocuments (два объекта), т.к.
// foundry-stub.mjs даёт foundry.utils.setProperty заглушкой-no-op и не может
// подтвердить фактическую простановку флагов на клонированном объекте.
describe("_onRender: data-both — обе стороны одним действием", () => {
  function fakeItem(id, name, extra = {}) {
    const calls = [];
    return {
      id, name, type: "implant",
      effects: { contents: [] },
      getFlag: () => undefined,
      setFlag: async (ns, key, v) => { calls.push(["setFlag", key, v]); },
      toObject: () => ({ _id: id, name, type: "implant" }),
      calls,
      ...extra,
    };
  }

  it("own: единственная неустановленная копия — клонирует вторую и ставит left/right на обе", async () => {
    const original = fakeItem("i1", "Bionic Leg (Repulsor)");
    const clone = fakeItem("clone1", "Bionic Leg (Repulsor)");
    const created = [];
    const actor = {
      id: "a1",
      items: {
        get: id => ({ i1: original, clone1: clone }[id] ?? null),
        filter: fn => [original].filter(fn),
      },
      createEmbeddedDocuments: async (type, objs) => { created.push([type, objs]); return [clone]; },
    };
    const selectNode = { value: "own:i1" };
    const rowNode = { querySelector: sel => (sel === "[data-install]" ? selectNode : null) };
    const bothNode = { dataset: { both: "legs" }, closest: sel => (sel === ".wh-surg-install-row" ? rowNode : null) };
    const app = appLike(actor, { "[data-both]": [bothNode] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    await app.element.handlers["[data-both]:click"]();

    expect(created).toEqual([["Item", [{ _id: undefined, name: "Bionic Leg (Repulsor)", type: "implant" }]]]);
    expect(original.calls).toEqual([["setFlag", "installed", true], ["setFlag", "bodySide", "left"]]);
    expect(clone.calls).toEqual([["setFlag", "installed", true], ["setFlag", "bodySide", "right"]]);
  });

  it("own: уже есть вторая неустановленная копия — доустанавливает обе без клонирования", async () => {
    const a = fakeItem("i1", "Bionic Leg (Repulsor)");
    const b = fakeItem("i2", "Bionic Leg (Repulsor)");
    const created = [];
    const actor = {
      id: "a1",
      items: {
        get: id => ({ i1: a, i2: b }[id] ?? null),
        filter: fn => [a, b].filter(fn),
      },
      createEmbeddedDocuments: async (type, objs) => { created.push([type, objs]); return []; },
    };
    const selectNode = { value: "own:i1" };
    const rowNode = { querySelector: sel => (sel === "[data-install]" ? selectNode : null) };
    const bothNode = { dataset: { both: "legs" }, closest: () => rowNode };
    const app = appLike(actor, { "[data-both]": [bothNode] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    await app.element.handlers["[data-both]:click"]();

    expect(created).toEqual([]);
    expect(a.calls).toEqual([["setFlag", "installed", true], ["setFlag", "bodySide", "left"]]);
    expect(b.calls).toEqual([["setFlag", "installed", true], ["setFlag", "bodySide", "right"]]);
  });

  it("lib: создаёт ДВА новых экземпляра одним вызовом createEmbeddedDocuments", async () => {
    const created = [];
    const actor = {
      id: "a1",
      items: { get: () => null, filter: () => [] },
      createEmbeddedDocuments: async (type, objs) => { created.push([type, objs]); return []; },
    };
    globalThis.fromUuid = async () => ({ name: "Bionic Leg (Arachnid)", toObject: () => ({ name: "Bionic Leg (Arachnid)" }) });
    const selectNode = { value: "lib:Compendium.warhammer-dbc.implants.Item.abc" };
    const rowNode = { querySelector: sel => (sel === "[data-install]" ? selectNode : null) };
    const bothNode = { dataset: { both: "legs" }, closest: () => rowNode };
    const app = appLike(actor, { "[data-both]": [bothNode] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    await app.element.handlers["[data-both]:click"]();

    expect(created.length).toBe(1);
    expect(created[0][0]).toBe("Item");
    expect(created[0][1]).toHaveLength(2);
  });

  it("без выбора в select — предупреждает и ничего не создаёт", async () => {
    captured.warnings = [];
    const actor = { id: "a1", items: { get: () => null, filter: () => [] }, createEmbeddedDocuments: async () => [] };
    const selectNode = { value: "" };
    const rowNode = { querySelector: () => selectNode };
    const bothNode = { dataset: { both: "legs" }, closest: () => rowNode };
    const app = appLike(actor, { "[data-both]": [bothNode] });
    SurgeonWindow.prototype._onRender.call(app, {}, {});
    await app.element.handlers["[data-both]:click"]();
    expect(captured.warnings.length).toBe(1);
  });
});
