// test/combat/movement-moved-flag.test.mjs
//
// flags.warhammer-dbc.movedThisTurn — закрывает пробел «нет трекинга
// движения по раундам», который раньше не давал автоматизировать удвоение
// бонуса Импульсного (Impulse) при «оружие не двигали с прошлого раунда»
// (attack-dialog.mjs) и попутно даёт зацепку будущим Талантам, завязанным на
// факт движения в этом Ходу. Ставится каждым из пяти боевых Действий
// Движения (declareHalfMove/FullMove/Charge/Run/Disengage) и, отдельно,
// реальным перемещением токена по канвасу (markMovedThisTurn изнутри
// initMovedFlagTracking — сама подписка на Hooks.on("updateToken") здесь не
// поднимается, как и у free-attack.mjs, проверяется только вызываемая логика).
// Снимается resetActionEconomy в начале следующего Хода (см. action-economy.test.mjs).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  declareHalfMove, declareFullMove, declareCharge, declareRun, declareDisengage,
  markMovedThisTurn
} from "../../module/combat/movement-actions.mjs";

/** Подставной актор с рабочими getFlag/setFlag/update (тот же приём, что у free-attack.test.mjs). */
function fakeActor(overrides = {}) {
  const flagStore = {};
  const actor = {
    name: "Подставной",
    system: { movement: { halfMove: 4, move: 8, charge: 12, run: 24 }, ...overrides },
    getFlag: (scope, key) => flagStore[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flagStore[`${scope}.${key}`] = value; },
    update: async (changes = {}) => {
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("Действия Движения ставят movedThisTurn", () => {
  it("Полудвижение", async () => {
    const actor = fakeActor();
    await declareHalfMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });

  it("Полное движение", async () => {
    const actor = fakeActor();
    await declareFullMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });

  it("Натиск", async () => {
    const actor = fakeActor();
    await declareCharge(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });

  it("Бег — ставит и movedThisTurn, и (как раньше) running", async () => {
    const actor = fakeActor();
    await declareRun(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "running")).toBe(true);
  });

  it("Выход из Боя — ставит и movedThisTurn, и (как раньше) disengageActive", async () => {
    const actor = fakeActor();
    await declareDisengage(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
  });
});

describe("markMovedThisTurn", () => {
  it("ставит флаг на чистом акторе", async () => {
    const actor = fakeActor();
    await markMovedThisTurn(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });

  it("уже стоящий флаг — без повторного setFlag (идемпотентно)", async () => {
    const actor = fakeActor();
    await markMovedThisTurn(actor);
    let calls = 0;
    const originalSetFlag = actor.setFlag;
    actor.setFlag = async (...args) => { calls++; return originalSetFlag(...args); };
    await markMovedThisTurn(actor);
    expect(calls).toBe(0);
  });

  it("без актора — не падает", async () => {
    await expect(markMovedThisTurn(null)).resolves.toBeUndefined();
  });
});
