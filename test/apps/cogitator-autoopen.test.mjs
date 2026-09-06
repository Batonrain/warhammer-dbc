// test/apps/cogitator-autoopen.test.mjs
//
// Автооткрытие Когитатора при входе клиента на привязанную сцену (wdbc-4hyt,
// подвопрос 2). Флаг Scene.flags.warhammer-dbc.autoOpenCogitator = { journalId,
// includeGm } выставляется из CogitatorManager (см. cogitator-v2.test.mjs);
// здесь — только сама разводка хука canvasReady → module/apps/cogitator.mjs
// → registerCogitatorAutoOpen.
//
// Hooks.on в foundry-stub.mjs — no-op, поэтому по образцу
// test/regions/scene-live-recalc.test.mjs подменяем его локальным
// перехватчиком, копящим колбэки по имени хука, и дёргаем их сами.
//
// Открытие консоли (openCogitator) в этом же модуле — вызвать его напрямую
// и убедиться, что не падает, тест уже делает в cogitator-v2.test.mjs
// («[data-open] открывает консоль»). Здесь проверяется, ДОХОДИТ ЛИ логика
// хука до этого вызова — через наблюдаемые прокси: сколько раз дошли до
// game.journal.get (после проверки флага/ГМ) и до j.testUserPermission
// (после проверки isCog, только для не-ГМ). Порядок проверок в
// registerCogitatorAutoOpen: флаг → ГМ/includeGm → journal.get → isCog →
// permission (не-ГМ) → openCogitator.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { registerCogitatorAutoOpen, AUTO_OPEN_FLAG } from "../../module/apps/cogitator.mjs";

let handlers;
beforeEach(() => {
  handlers = {};
  globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
});

function fire(name, ...args) {
  for (const fn of handlers[name] || []) fn(...args);
}

/** Сцена-заглушка с флагом autoOpenCogitator (или без него). */
function fakeScene(flagValue) {
  return { id: "scene-1", getFlag: (ns, key) => (ns === "warhammer-dbc" && key === AUTO_OPEN_FLAG) ? flagValue : undefined };
}

/** Журнал-когитатор (или обычный) со счётчиком обращений к testUserPermission. */
function fakeJournal({ isCogitator = true, permission = true } = {}) {
  const calls = { testUserPermission: 0 };
  return {
    calls,
    id: "cog-1",
    getFlag: (ns, key) => (ns === "warhammer-dbc" && key === "cogitator") ? (isCogitator ? { title: "Т" } : null) : null,
    testUserPermission: () => { calls.testUserPermission++; return permission; }
  };
}

describe("registerCogitatorAutoOpen", () => {
  it("регистрирует ровно один обработчик canvasReady", () => {
    registerCogitatorAutoOpen();
    expect(handlers.canvasReady).toHaveLength(1);
  });

  it("без сцены (canvas.scene пуст) ничего не делает", () => {
    globalThis.canvas = { scene: null };
    registerCogitatorAutoOpen();
    expect(() => fire("canvasReady")).not.toThrow();
  });

  it("без флага на сцене не трогает game.journal", () => {
    const savedJournal = game.journal;
    try {
      let getCalls = 0;
      game.journal = { get: () => { getCalls++; return null; } };
      globalThis.canvas = { scene: fakeScene(undefined) };
      registerCogitatorAutoOpen();
      fire("canvasReady");
      expect(getCalls).toBe(0);
    } finally { game.journal = savedJournal; }
  });

  it("ГМ без includeGm: флаг есть, но journal.get не вызывается — терминал не лезет к ГМу без спроса", () => {
    const savedJournal = game.journal, savedUser = game.user;
    try {
      let getCalls = 0;
      game.journal = { get: () => { getCalls++; return null; } };
      game.user = { isGM: true, id: "gm1" };
      globalThis.canvas = { scene: fakeScene({ journalId: "cog-1", includeGm: false }) };
      registerCogitatorAutoOpen();
      fire("canvasReady");
      expect(getCalls).toBe(0);
    } finally { game.journal = savedJournal; game.user = savedUser; }
  });

  it("ГМ с includeGm: доходит до journal.get и isCog, но НЕ проверяет testUserPermission (ГМ видит всё)", () => {
    const savedJournal = game.journal, savedUser = game.user;
    try {
      const j = fakeJournal({ isCogitator: true });
      game.journal = { get: id => (id === "cog-1" ? j : null) };
      game.user = { isGM: true, id: "gm1" };
      globalThis.canvas = { scene: fakeScene({ journalId: "cog-1", includeGm: true }) };
      registerCogitatorAutoOpen();
      expect(() => fire("canvasReady")).not.toThrow();
      expect(j.calls.testUserPermission).toBe(0);
    } finally { game.journal = savedJournal; game.user = savedUser; }
  });

  it("journalId указывает не на когитатор (обычный журнал) — testUserPermission не спрашивается", () => {
    const savedJournal = game.journal, savedUser = game.user;
    try {
      const j = fakeJournal({ isCogitator: false });
      game.journal = { get: () => j };
      game.user = { isGM: false, id: "p1" };
      globalThis.canvas = { scene: fakeScene({ journalId: "cog-1", includeGm: false }) };
      registerCogitatorAutoOpen();
      fire("canvasReady");
      expect(j.calls.testUserPermission).toBe(0);
    } finally { game.journal = savedJournal; game.user = savedUser; }
  });

  it("игрок без прав на журнал: testUserPermission спрошен (и вернул false) — доступа нет", () => {
    const savedJournal = game.journal, savedUser = game.user;
    try {
      const j = fakeJournal({ isCogitator: true, permission: false });
      game.journal = { get: () => j };
      game.user = { isGM: false, id: "p1" };
      globalThis.canvas = { scene: fakeScene({ journalId: "cog-1", includeGm: false }) };
      registerCogitatorAutoOpen();
      fire("canvasReady");
      expect(j.calls.testUserPermission).toBe(1);
    } finally { game.journal = savedJournal; game.user = savedUser; }
  });

  it("игрок, флаг указывает на когитатор с доступом — доходит до открытия без ошибок", () => {
    const savedJournal = game.journal, savedUser = game.user;
    try {
      const j = fakeJournal({ isCogitator: true, permission: true });
      game.journal = { get: () => j };
      game.user = { isGM: false, id: "p1" };
      globalThis.canvas = { scene: fakeScene({ journalId: "cog-1", includeGm: false }) };
      registerCogitatorAutoOpen();
      expect(() => fire("canvasReady")).not.toThrow();
      expect(j.calls.testUserPermission).toBe(1);
    } finally { game.journal = savedJournal; game.user = savedUser; }
  });
});
