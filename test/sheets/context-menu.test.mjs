import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateItemContextMenu,
  closeContextMenus,
  openContextMenu
} from "../../module/sheets/context-menu.mjs";

// Подставной jQuery: настоящий недоступен в тестах, а меню строится именно им.
// Узел запоминает свой html, css и привязанные обработчики — этого хватает,
// чтобы проверить состав пунктов и то, что клик закрывает меню.
function fakeJq() {
  const state = { appended: [], removedSelectors: [], documentOff: [], documentOne: [] };

  function node(html) {
    const handlers = {};
    const self = { html, styles: null, removed: false, handlers };
    self.css = styles => { self.styles = styles; return self; };
    self.remove = () => { self.removed = true; return self; };
    self.find = selector => ({
      on: (eventName, fn) => { handlers[`${selector}:${eventName}`] = fn; }
    });
    return self;
  }

  const jq = arg => {
    if (typeof arg === "string" && arg.trim().startsWith("<")) return node(arg);
    if (arg === globalThis.document || arg === undefined) {
      return {
        off: name => state.documentOff.push(name),
        one: (name, fn) => state.documentOne.push([name, fn])
      };
    }
    if (arg === "body") return { append: n => state.appended.push(n) };
    if (typeof arg === "string") return { remove: () => state.removedSelectors.push(arg) };
    // Строка предмета: у неё спрашивают только data("item-id").
    return { data: key => arg?.dataset?.[key === "item-id" ? "itemId" : key] };
  };
  jq.state = state;
  return jq;
}

function contextEvent(dataset = {}) {
  return {
    clientX: 120,
    clientY: 40,
    preventDefault: () => {},
    stopPropagation: () => {},
    currentTarget: { dataset }
  };
}

function item(id = "item-1", name = "Болт-пистолет") {
  const it = {
    id,
    name,
    deleted: false,
    sheet: { rendered: 0, render: () => { it.sheet.rendered += 1; } },
    delete: async () => { it.deleted = true; }
  };
  return it;
}

function actor(items = []) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { id: "actor-1", items: list };
}

beforeEach(() => {
  resetCaptured();
  vi.useRealTimers();
});

describe("openContextMenu", () => {
  it("строит пункты, ставит меню у курсора и вешает закрытие по клику", () => {
    const jq = fakeJq();
    const calls = [];

    const menu = openContextMenu(contextEvent(), [
      { cls: "wh-ctx-a", label: "Первый", onClick: () => calls.push("a") },
      { cls: "wh-ctx-b", label: "Второй", onClick: () => calls.push("b") }
    ], jq);

    expect(menu.html).toContain('class="wh-ctx-item wh-ctx-a"');
    expect(menu.html).toContain("Второй");
    expect(menu.styles).toEqual({ top: "40px", left: "120px", position: "fixed" });
    expect(jq.state.appended).toEqual([menu]);
    expect(jq.state.removedSelectors).toEqual([".wh-context-menu"]);

    menu.handlers[".wh-ctx-b:click"]({ stopPropagation: () => {} });

    expect(calls).toEqual(["b"]);
    expect(menu.removed).toBe(true);
    expect(jq.state.documentOff).toEqual(["click.wh-ctx"]);
  });

  it("пункт-чекбокс рисует текущее состояние и переключает клюком по себе", () => {
    const jq = fakeJq();
    let checked = false;

    const menu = openContextMenu(contextEvent(), [
      { cls: "wh-ctx-tog", label: "Пробуждение", checkbox: true, checked: true,
        onClick: () => { checked = true; } }
    ], jq);

    expect(menu.html).toContain('<label class="wh-ctx-item wh-ctx-checkbox wh-ctx-tog">');
    expect(menu.html).toContain('<input type="checkbox" checked/>');
    expect(menu.html).toContain("Пробуждение");

    menu.handlers[".wh-ctx-tog:click"]({ stopPropagation: () => {} });
    expect(checked).toBe(true);
  });

  it("каскадный пункт {submenu} раскрывает вложенные листовые пункты и вешает их клики", () => {
    const jq = fakeJq();
    const calls = [];

    const menu = openContextMenu(contextEvent(), [
      {
        cls: "wh-ctx-align", label: "Мировоззрение", submenu: [
          { cls: "wh-ctx-align-a", label: "Лоялист", onClick: () => calls.push("loyalist") },
          { cls: "wh-ctx-align-b", label: "Ренегат", checkbox: true, checked: true,
            onClick: () => calls.push("renegade") }
        ]
      },
      { cls: "wh-ctx-plain", label: "Обычный пункт", onClick: () => calls.push("plain") }
    ], jq);

    expect(menu.html).toContain('class="wh-ctx-item wh-ctx-parent wh-ctx-align"');
    expect(menu.html).toContain("wh-ctx-submenu");

    // Вложенные листовые пункты кликаются как обычные, независимо от глубины.
    menu.handlers[".wh-ctx-align-a:click"]({ stopPropagation: () => {} });
    expect(calls).toEqual(["loyalist"]);
    expect(menu.removed).toBe(true);
  });

  // wdbc-0cgo: наведения на тач-экранах не бывает — родитель каскадного
  // подпункта раскрывает вложенные пункты кликом по себе (класс open),
  // а не только наведением.
  it("клик по родителю каскадного подпункта переключает класс open, не закрывая меню и не вызывая onClick", () => {
    const jq = fakeJq();
    const calls = [];

    const menu = openContextMenu(contextEvent(), [
      { cls: "wh-ctx-align", label: "Мировоззрение", submenu: [
        { cls: "wh-ctx-align-a", label: "Лоялист", onClick: () => calls.push("loyalist") }
      ] }
    ], jq);

    let stopped = false;
    const fakeParentEl = { classList: { toggled: [], toggle(c) { this.toggled.push(c); } } };
    menu.handlers[".wh-ctx-align:click"]({ stopPropagation: () => { stopped = true; }, currentTarget: fakeParentEl });

    expect(fakeParentEl.classList.toggled).toEqual(["open"]);
    expect(stopped).toBe(true);
    expect(calls).toEqual([]);
    expect(menu.removed).toBe(false);
  });

  it("одноразовое закрытие вешается с задержкой — клик-открытие не схлопывает меню", async () => {
    vi.useFakeTimers();
    const jq = fakeJq();

    openContextMenu(contextEvent(), [{ cls: "wh-ctx-a", label: "A", onClick: () => {} }], jq);
    expect(jq.state.documentOne).toHaveLength(0);

    vi.advanceTimersByTime(50);
    expect(jq.state.documentOne[0][0]).toBe("click.wh-ctx");
  });
});

describe("closeContextMenus", () => {
  it("снимает меню и отвязывает обработчик", () => {
    const jq = fakeJq();

    closeContextMenus(jq);

    expect(jq.state.removedSelectors).toEqual([".wh-context-menu"]);
    expect(jq.state.documentOff).toEqual(["click.wh-ctx"]);
  });
});

describe("activateItemContextMenu", () => {
  function wire(a, jq) {
    let handler = null;
    const html = { find: () => ({ on: (_name, fn) => { handler = fn; } }) };
    activateItemContextMenu(html, a, jq);
    return handler;
  }

  it("открывает лист предмета и удаляет его пунктами меню", async () => {
    const jq = fakeJq();
    const gun = item("gun-1");
    const handler = wire(actor([gun]), jq);

    handler(contextEvent({ itemId: "gun-1" }));
    const menu = jq.state.appended[0];

    menu.handlers[".wh-ctx-edit:click"]({ stopPropagation: () => {} });
    expect(gun.sheet.rendered).toBe(1);

    handler(contextEvent({ itemId: "gun-1" }));
    await jq.state.appended[1].handlers[".wh-ctx-delete:click"]({ stopPropagation: () => {} });
    expect(gun.deleted).toBe(true);
  });

  // Меню открывается по ПКМ и стоит прямо под курсором: промах мимо
  // «Редактировать» стирал предмет молча и без отката (wdbc-9z9).
  it("удаление спрашивает подтверждение и называет предмет", async () => {
    const jq = fakeJq();
    const gun = item("gun-1", "Болтер «Годвин»");
    const handler = wire(actor([gun]), jq);

    handler(contextEvent({ itemId: "gun-1" }));
    await jq.state.appended[0].handlers[".wh-ctx-delete:click"]({ stopPropagation: () => {} });

    expect(captured.dialog, "подтверждения не спросили").not.toBeNull();
    expect(captured.dialog.content).toContain("Болтер «Годвин»");
    expect(gun.deleted).toBe(true);
  });

  // content диалога разбирается как HTML, а имя предмета задаёт игрок на своём
  // акторе: без экранирования разметка в названии исполнилась бы у того, кто
  // подтверждает удаление.
  it("имя предмета попадает в диалог экранированным", async () => {
    const jq = fakeJq();
    const gun = item("gun-1", `<img src=x onerror="alert(1)">`);
    const handler = wire(actor([gun]), jq);

    handler(contextEvent({ itemId: "gun-1" }));
    await jq.state.appended[0].handlers[".wh-ctx-delete:click"]({ stopPropagation: () => {} });

    expect(captured.dialog.content).not.toContain("<img");
    expect(captured.dialog.content).toContain("&lt;img");
  });

  it("отказ оставляет предмет на месте", async () => {
    const jq = fakeJq();
    const gun = item("gun-1");
    const handler = wire(actor([gun]), jq);
    captured.confirmAnswer = false;

    handler(contextEvent({ itemId: "gun-1" }));
    await jq.state.appended[0].handlers[".wh-ctx-delete:click"]({ stopPropagation: () => {} });

    expect(gun.deleted).toBe(false);
  });

  it("«Редактировать» ничего не спрашивает", () => {
    const jq = fakeJq();
    const gun = item("gun-1");
    const handler = wire(actor([gun]), jq);

    handler(contextEvent({ itemId: "gun-1" }));
    jq.state.appended[0].handlers[".wh-ctx-edit:click"]({ stopPropagation: () => {} });

    expect(captured.dialog).toBeNull();
    expect(gun.sheet.rendered).toBe(1);
  });

  it("не строит меню, если предмета уже нет", () => {
    const jq = fakeJq();
    const handler = wire(actor([]), jq);

    handler(contextEvent({ itemId: "ghost" }));

    expect(jq.state.appended).toEqual([]);
    expect(jq.state.removedSelectors).toEqual([".wh-context-menu"]);
  });
});
