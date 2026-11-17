// test/hooks-advance-pricing-setting.test.mjs
//
// pricing-mode-createsetting: смена мировой настройки «Система цен Продвижения»
// (warhammer-dbc.advancePricingMode) должна пересчитать цены у всех Персонажей.
// Хук слушал только updateSetting; а ПЕРВОЕ сохранение настройки в мире — это
// создание документа Setting (createSetting), и пересчёт не запускался: уже
// купленное оставалось по старой системе цен. Проверяем оба хука.
//
// Эти хуки в module/hooks.mjs вешаются на верхнем уровне модуля (при импорте,
// а не в registerHooks()), поэтому перехватчик Hooks.on ставится ДО импорта.

import { describe, it, expect, beforeEach, vi } from "vitest";
import "./support/foundry-stub.mjs";

const recalcAllAdvanceCosts = vi.fn(async () => {});
vi.mock("../module/sheets/tabs/advance.mjs", async importOriginal => ({
  ...(await importOriginal()),
  recalcAllAdvanceCosts
}));

const handlers = {};
globalThis.Hooks = {
  on: (name, fn) => { (handlers[name] ??= []).push(fn); },
  once: () => {},
  callAll: () => {}
};

await import("../module/hooks.mjs");

const KEY = "warhammer-dbc.advancePricingMode";

beforeEach(() => {
  recalcAllAdvanceCosts.mockClear();
  globalThis.game.user = { id: "gm1", isGM: true };
  globalThis.game.actors = [
    { id: "c1", type: "character" },
    { id: "n1", type: "npc" },
    { id: "c2", type: "character" }
  ];
});

/**
 * Запускает все зарегистрированные обработчики события с НАСТОЯЩЕЙ сигнатурой
 * Foundry: updateSetting — (doc, changes, options, userId), createSetting —
 * (doc, options, userId). Одинаковые аргументы для обоих скрыли бы перепутанный userId.
 */
async function fire(event, setting, userId) {
  const args = event === "createSetting"
    ? [setting, {}, userId]
    : [setting, {}, {}, userId];
  for (const fn of handlers[event] ?? []) await fn(...args);
}

describe("цены Продвижения при смене мировой настройки (pricing-mode-createsetting)", () => {
  it("updateSetting — пересчитывает цены только у Персонажей", async () => {
    await fire("updateSetting", { key: KEY }, "gm1");
    expect(recalcAllAdvanceCosts).toHaveBeenCalledTimes(2);
    expect(recalcAllAdvanceCosts.mock.calls.map(c => c[0].id)).toEqual(["c1", "c2"]);
  });

  it("createSetting (первое сохранение настройки в мире) — тоже пересчитывает", async () => {
    await fire("createSetting", { key: KEY }, "gm1");
    expect(recalcAllAdvanceCosts).toHaveBeenCalledTimes(2);
    expect(recalcAllAdvanceCosts.mock.calls.map(c => c[0].id)).toEqual(["c1", "c2"]);
  });

  it("чужая настройка не запускает пересчёт ни на update, ни на create", async () => {
    await fire("updateSetting", { key: "warhammer-dbc.somethingElse" }, "gm1");
    await fire("createSetting", { key: "warhammer-dbc.somethingElse" }, "gm1");
    expect(recalcAllAdvanceCosts).not.toHaveBeenCalled();
  });

  it("userId-гвард: пересчёт делает только тот, кто сменил настройку", async () => {
    await fire("updateSetting", { key: KEY }, "someone-else");
    await fire("createSetting", { key: KEY }, "someone-else");
    expect(recalcAllAdvanceCosts).not.toHaveBeenCalled();
  });
});
