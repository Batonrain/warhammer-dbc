// test/combat/force-move-menu.test.mjs
//
// Единый диалог «Через Силу» (стр. 27) — сценарий выбирается по числу
// отмеченных целей: 0 — соло, 1 — Против Техники, 2+ — Совместное
// Перемещение. wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { showForceMoveMenu, initForceMoveHud } from "../../module/combat/force-move-menu.mjs";

function actor(name = "Гвардеец") {
  return { id: `a-${name}`, name, type: "character", system: { actionPoints: { value: 2, max: 2 } } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: [], isGM: false };
});

describe("showForceMoveMenu — выбор сценария по отмеченным целям", () => {
  it("без целей — сценарий «Через Силу / Массивные Предметы»", () => {
    showForceMoveMenu(actor());
    expect(captured.dialog.content).toContain("Через Силу / Массивные Предметы");
  });

  it("одна цель — сценарий «Против Техники»", () => {
    globalThis.game.user.targets = [{ actor: actor("Пилот") }];
    showForceMoveMenu(actor());
    expect(captured.dialog.content).toContain("Против Техники");
    expect(captured.dialog.content).toContain("Пилот");
  });

  it("несколько целей — сценарий «Совместное Перемещение»", () => {
    globalThis.game.user.targets = [{ actor: actor("A") }, { actor: actor("B") }];
    showForceMoveMenu(actor());
    expect(captured.dialog.content).toContain("Совместное Перемещение");
    expect(captured.dialog.content).toContain("ассистентов — 2");
  });
});

describe("initForceMoveHud — гейт кнопки Token HUD", () => {
  class FakeElement {
    constructor() { this.children = []; }
    querySelector(sel) {
      if (sel === ".wh-force-move-btn") return this.children.find(c => c.className?.includes("wh-force-move-btn")) ?? null;
      return null;
    }
    appendChild(child) { this.children.push(child); }
  }

  let handlers;
  beforeEach(() => {
    handlers = {};
    globalThis.HTMLElement = class {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    globalThis.document = { createElement: () => ({ addEventListener() {}, set className(v) { this._c = v; }, get className() { return this._c; } }) };
    initForceMoveHud();
  });

  function fire(hud, el) { for (const fn of handlers.renderTokenHUD ?? []) fn(hud, [el]); }

  it("свой токен (isOwner) — кнопка добавляется", () => {
    const a = actor();
    a.isOwner = true;
    const el = new FakeElement();
    fire({ object: { document: { actor: a } } }, el);
    expect(el.children.length).toBe(1);
  });

  it("чужой токен, не ГМ — кнопки нет", () => {
    const a = actor();
    a.isOwner = false;
    globalThis.game.user.isGM = false;
    const el = new FakeElement();
    fire({ object: { document: { actor: a } } }, el);
    expect(el.children.length).toBe(0);
  });

  it("чужой токен, ГМ — кнопка добавляется (может решать за NPC)", () => {
    const a = actor();
    a.isOwner = false;
    globalThis.game.user.isGM = true;
    const el = new FakeElement();
    fire({ object: { document: { actor: a } } }, el);
    expect(el.children.length).toBe(1);
  });
});
