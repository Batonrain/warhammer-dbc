// test/apps/mechanics-script-throttle.test.mjs
//
// runMechScriptEntry (module/apps/mechanics.mjs, wdbc-f4jt) — кнопка «▶
// Запустить» записи kind:"script": повторно нажимаемый путь, в отличие от
// applyMechEntry (тот отыгрывает script один раз при получении предмета).
// scriptThrottleUnit гейтит ТОЛЬКО эту кнопку через module/rules/cooldown.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

function itemWithScript(entry) {
  const store = { "warhammer-dbc.mechanics": [{ id: "g1", operator: "AND", entries: [entry] }] };
  return {
    name: "Тестовый предмет",
    actor: null,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; return value; }
  };
}

afterEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  globalThis.game.time = undefined;
});

describe("runMechScriptEntry: без «Частоты» — кнопка отрабатывает всегда", () => {
  it("выполняет код каждый раз", async () => {
    const item = itemWithScript({ id: "e1", kind: "script", code: 'await item.setFlag("test","ran",true);' });
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBe(true);
    await item.setFlag("test", "ran", false);
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBe(true);
  });

  it("пустой код — предупреждение, ничего не выполняется", async () => {
    const item = itemWithScript({ id: "e1", kind: "script", code: "" });
    await runMechScriptEntry(item, "g1", "e1");
    expect(captured.warnings.length).toBe(1);
  });

  it("не kind:\"script\" — тихо ничего не делает", async () => {
    const item = itemWithScript({ id: "e1", kind: "characteristic", code: 'await item.setFlag("test","ran",true);' });
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBeUndefined();
    expect(captured.warnings.length).toBe(0);
  });
});

describe("runMechScriptEntry: throttleUnit=\"round\" гейтит повторный запуск", () => {
  it("первый запуск проходит, второй в том же Раунде — блокируется предупреждением", async () => {
    globalThis.game.combat = { round: 1 };
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "round",
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);' });
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(1);

    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(1); // не выполнился второй раз
    expect(captured.warnings.length).toBe(1);
  });

  it("новый Раунд снова разрешает запуск", async () => {
    globalThis.game.combat = { round: 1 };
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "round",
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);' });
    await runMechScriptEntry(item, "g1", "e1");
    globalThis.game.combat = { round: 2 };
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(2);
  });
});

describe("runMechScriptEntry: throttleUnit=\"day\" (worldTime) и провал кода", () => {
  it("успешный запуск заводит суточную перезарядку", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "day",
      code: 'await item.setFlag("test","ran",true);' });
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBe(true);

    await item.setFlag("test", "ran", false);
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBe(false); // всё ещё заблокировано
    expect(captured.warnings.length).toBe(1);

    globalThis.game.time = { worldTime: 100000 + 86401 };
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBe(true);
  });

  it("код бросает исключение — попытка НЕ тратится (провал не должен запирать кулдаун)", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "day",
      code: 'throw new Error("бум");' });
    await runMechScriptEntry(item, "g1", "e1");
    expect(captured.errors.length).toBe(1);
    // Кулдаун не заведён провалом — флаг перезарядки не появился на предмете.
    expect(item.getFlag("warhammer-dbc", "mechScript-e1")).toBeUndefined();
  });
});

describe("runMechScriptEntry: scriptThrottleMax > 1 — счётчик «до N раз» (Bone Song и подобные)", () => {
  it("session, max=3: три запуска проходят, четвёртый блокируется", async () => {
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "session", scriptThrottleMax: 3,
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);' });
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(3);

    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(3); // четвёртый не выполнился
    expect(captured.warnings.length).toBe(1);
  });

  it("round, max=2: живое сравнение — новый Раунд снова даёт полный запас", async () => {
    globalThis.game.combat = { round: 1 };
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "round", scriptThrottleMax: 2,
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);' });
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1"); // третий в том же Раунде — блокируется
    expect(item.getFlag("test", "count")).toBe(2);

    globalThis.game.combat = { round: 2 };
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(4);
  });

  it("day, max=2: счётчик по календарным суткам (Skillful Torture, wdbc-sk8s)", async () => {
    globalThis.game.time = { worldTime: 0 };
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "day", scriptThrottleMax: 2,
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);' });
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1"); // третий в те же сутки — блокируется
    expect(item.getFlag("test", "count")).toBe(2);
    expect(captured.warnings.length).toBe(1);

    globalThis.game.time = { worldTime: 86400 + 10 }; // новые сутки
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(3);
  });

  it("max=1 (умолчание) — ведёт себя как единичный gate, а не счётчик", async () => {
    const item = itemWithScript({ id: "e1", kind: "script", scriptThrottleUnit: "session",
      code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);' });
    await runMechScriptEntry(item, "g1", "e1");
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(1);
    expect(captured.warnings.length).toBe(1);
  });
});
