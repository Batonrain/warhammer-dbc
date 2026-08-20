// test/apps/player-access.test.mjs
//
// Кнопка «Начать создание персонажа» в панели «Актёры». Стоит у всех, а не
// только у Мастера: право «создавать Актёров» в Foundry по умолчанию есть лишь
// у Помощника и Мастера, и пряталась бы она ровно у тех, кому нужна. Без своего
// права кнопка просит Мастера — тот заводит лист и отдаёт его просителю.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerCharacterStartButton, startCharacterCreation } from "../../module/apps/character-start.mjs";

/**
 * Узел панели: DOM в тестах нет, а кнопку вставляют обычными методами узла —
 * их и хватает. Поиск по селектору держим на именах классов: других селекторов
 * кнопке не нужно.
 */
class FakeNode {
  constructor(className = "") { this.className = className; this.children = []; }
  appendChild(node) { this.children.push(node); return node; }
  prepend(node) { this.children.unshift(node); return node; }
  addEventListener() {}
  querySelector(selector) {
    const classes = selector.split(",").map(s => s.trim().replace(/^\./, "").split(" ")[0]);
    const hit = node => classes.some(c => String(node.className).split(" ").includes(c));
    for (const node of this.children) {
      if (hit(node)) return node;
      const deep = node.querySelector?.(selector);
      if (deep) return deep;
    }
    return null;
  }
}

describe("«Начать создание персонажа»", () => {
  let hooked, root;

  beforeEach(() => {
    hooked = null;
    globalThis.Hooks = { on: (event, fn) => { if (event === "renderActorDirectory") hooked = fn; } };
    globalThis.document = { createElement: () => new FakeNode() };

    root = new FakeNode();
    root.appendChild(new FakeNode("directory-header"));
  });

  /** Панель «Актёры» глазами пользователя с заданными правами. */
  const renderDirectory = (can) => {
    globalThis.game = { ...globalThis.game, user: { id: "u1", can: () => can } };
    registerCharacterStartButton();
    hooked({}, root);
    return root.querySelector(".wh-start-character");
  };

  it("кнопка стоит и у того, кому создавать Актёров не разрешено", () => {
    expect(renderDirectory(false)).not.toBeNull();
  });

  it("со своим правом персонаж заводится на месте", async () => {
    const created = { sheet: { render: vi.fn(), openCreationWizard: vi.fn() } };
    globalThis.Actor = { create: vi.fn(async () => created) };
    globalThis.game = { ...globalThis.game, user: { id: "u1", can: () => true } };

    const actor = await startCharacterCreation();

    expect(Actor.create).toHaveBeenCalledWith({ name: "Новый персонаж", type: "character" });
    expect(created.sheet.openCreationWizard).toHaveBeenCalled();
    expect(actor).toBe(created);
  });

  it("без права — просьба уходит Мастеру, а не ошибка прав", async () => {
    const emit = vi.fn();
    globalThis.Actor = { create: vi.fn() };
    globalThis.game = {
      ...globalThis.game,
      user:   { id: "u1", can: () => false },
      users:  { activeGM: { id: "gm" } },
      socket: { emit }
    };

    const actor = await startCharacterCreation();

    expect(Actor.create).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("system.warhammer-dbc", { action: "startCharacter", userId: "u1" });
    expect(actor).toBeNull();
  });

  it("без права и без Мастера в игре — предупреждение, запрос никуда не уходит", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    globalThis.Actor = { create: vi.fn() };
    globalThis.ui = { ...globalThis.ui, notifications: { warn, info: vi.fn() } };
    globalThis.game = {
      ...globalThis.game,
      user:   { id: "u1", can: () => false },
      users:  { activeGM: null },
      socket: { emit }
    };

    expect(await startCharacterCreation()).toBeNull();
    expect(emit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
