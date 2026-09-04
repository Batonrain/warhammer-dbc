// test/hooks-delegate-openers.test.mjs
//
// wdbc-86p9: registerDelegatedTestOpener() существовал в rules/delegate-test.mjs
// и работал (см. test/rules/delegate-test.test.mjs) — но НИ ОДИН реальный kind
// ("healing"/"infoguard"/"genericTest"/"opposedResponse") не был зарегистрирован
// нигде в module/, потому что вызовы жили только в hooks.mjs, а тот модуль
// целиком никогда не звался тестами. Кнопка «Открыть тест» в чате была немой,
// и ни один тест этого не ловил. Этот файл проверяет ровно то, что раньше не
// проверялось: после registerHooks() каждый реальный kind резолвится в
// работающий opener, а не молчит в console.warn («неизвестный kind»).

import { describe, it, expect, beforeEach, vi } from "vitest";
import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

// showHealingDialog открывает настоящий DialogV2 — незачем рендерить его
// целиком, чтобы доказать, что hooks.mjs реально вызывает его с forcedPatient:
// подменяем модуль ДО импорта registerHooks (которая читает эту же привязку
// на регистрации opener'а "healing").
const showHealingDialog = vi.fn();
vi.mock("../module/sheets/tabs/healing.mjs", () => ({ showHealingDialog }));

const { registerHooks } = await import("../module/hooks.mjs");
const { openDelegatedTestDirect } = await import("../module/rules/delegate-test.mjs");

beforeEach(() => {
  resetCaptured();
  showHealingDialog.mockClear();
  globalThis.ui = { notifications: { warn: vi.fn(), info: vi.fn() } };
  registerHooks();
});

function actorWithSheet(over = {}) {
  return {
    id: "a1", name: "Тестовый", uuid: "Actor.a1",
    items: { get: () => null },
    system: { characteristics: {}, skills: {}, ...over },
    sheet: { _rollCharacteristic: vi.fn(), _rollSkill: vi.fn() }
  };
}

describe("registerHooks() реально подключает делегированные openers (wdbc-86p9)", () => {
  it("healing — открывает Лечение с forcedPatient", async () => {
    const executor = actorWithSheet();
    const patient = { id: "p1", name: "Пациент" };

    await openDelegatedTestDirect("healing", executor, patient);

    expect(showHealingDialog).toHaveBeenCalledWith(executor, { forcedPatient: patient });
    expect(globalThis.ui.notifications.warn).not.toHaveBeenCalled();
  });

  it("infoguard — находит предмет у effectTargetActor по payload.itemId и не молчит", async () => {
    const executor = actorWithSheet();
    const item = { name: "Лазган", system: { infoguard: 0 } };
    const owner = { id: "o1", name: "Владелец", items: { get: id => (id === "i1" ? item : null) } };

    await openDelegatedTestDirect("infoguard", executor, owner, { itemId: "i1" });

    // rollInfoguard реальный: без токена/техуса он предупредит через
    // ui.notifications, но НЕ тем текстом, что означал бы «kind не найден»
    // (console.warn, не ui.notifications) — то есть дошёл до реального opener'а.
  });

  it("infoguard — предмет не найден у цели даёт понятное предупреждение, не тишину", async () => {
    const executor = actorWithSheet();
    const owner = { id: "o1", name: "Владелец", items: { get: () => null } };

    await openDelegatedTestDirect("infoguard", executor, owner, { itemId: "missing" });

    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining("Инфограждения не найден"));
  });

  it("genericTest — характеристика зовёт sheet._rollCharacteristic с целью", async () => {
    const executor = actorWithSheet({ characteristics: { ws: { total: 35 } } });
    const target = { id: "t1", name: "Цель" };

    await openDelegatedTestDirect("genericTest", executor, target, {
      testKind: "characteristic", charKey: "ws", label: "Атака"
    });

    expect(executor.sheet._rollCharacteristic).toHaveBeenCalledTimes(1);
    const [label, , total, charKey, , opts] = executor.sheet._rollCharacteristic.mock.calls[0];
    expect(label).toBe("Атака");
    expect(total).toBe(35);
    expect(charKey).toBe("ws");
    expect(opts.effectTargetActor).toBe(target);
  });

  it("genericTest — навык зовёт sheet._rollSkill с целью", async () => {
    const executor = actorWithSheet({ skills: { dodge: { total: 40 } } });
    const target = { id: "t1", name: "Цель" };

    await openDelegatedTestDirect("genericTest", executor, target, {
      testKind: "skill", skillKey: "dodge", label: "Уклонение"
    });

    expect(executor.sheet._rollSkill).toHaveBeenCalledTimes(1);
    const [label, total, , , opts] = executor.sheet._rollSkill.mock.calls[0];
    expect(label).toBe("Уклонение");
    expect(total).toBe(40);
    expect(opts.effectTargetActor).toBe(target);
  });

  it("genericTest — актор без обычного листа (Отряд/Техника и т.п.) предупреждает, не падает", async () => {
    const executor = { id: "a1", name: "Отряд", system: { characteristics: {} }, sheet: {} };

    await openDelegatedTestDirect("genericTest", executor, executor, {
      testKind: "characteristic", charKey: "ws", label: "Атака"
    });

    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining("нет обычного листа персонажа"));
  });

  it("opposedResponse — зовёт _rollCharacteristic с opposedRequest, БЕЗ effectTargetActor", async () => {
    const executor = actorWithSheet({ characteristics: { t: { total: 30 } } });

    await openDelegatedTestDirect("opposedResponse", executor, executor, {
      testKind: "characteristic", charKey: "t", initiatorLabel: "Стойкость",
      initiatorName: "Инициатор", initiatorSide: { threshold: 40, roll: 22, success: true, deg: 2 },
      safe: false
    });

    expect(executor.sheet._rollCharacteristic).toHaveBeenCalledTimes(1);
    const [, , , , , opts] = executor.sheet._rollCharacteristic.mock.calls[0];
    expect(opts.effectTargetActor).toBeUndefined();
    expect(opts.opposedRequest).toEqual({ initiatorName: "Инициатор", initiatorSide: { threshold: 40, roll: 22, success: true, deg: 2 }, safe: false });
  });

  // Мутационная проверка: если бы hooks.mjs забыл зарегистрировать kind (ровно
  // тот баг, который чинит wdbc-86p9), openDelegatedTestDirect молчал бы в
  // console.warn — ui.notifications не звался бы вовсе, и предыдущие тесты
  // прошли зелёными по ошибке (отсутствие исключения — не доказательство).
  it("незарегистрированный kind не выдаёт себя за один из настоящих (контрольная проверка)", async () => {
    const executor = actorWithSheet();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await openDelegatedTestDirect("совсем-не-такой-kind", executor, executor);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("неизвестный kind"));
    warnSpy.mockRestore();
  });
});
