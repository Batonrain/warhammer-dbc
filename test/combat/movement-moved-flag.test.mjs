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
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  declareHalfMove, declareFullMove, declareCharge, declareRun, declareDisengage,
  markMovedThisTurn, markMoveDegreeThisTurn
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

// Повален (стр. 30-31, wdbc-r5o7.2): «нельзя Бег и Натиск».
describe("Повален блокирует Натиск и Бег", () => {
  it("Натиск — предупреждение, meleeBase и movedThisTurn не трогаются", async () => {
    const actor = fakeActor({ conditions: { prone: true } });
    await declareCharge(actor);
    expect(actor.system.meleeBase).toBeUndefined();
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
    expect(captured.warnings.some(w => w.includes("Натиск"))).toBe(true);
  });

  it("Бег — предупреждение, running и movedThisTurn не трогаются", async () => {
    const actor = fakeActor({ conditions: { prone: true } });
    await declareRun(actor);
    expect(actor.getFlag("warhammer-dbc", "running")).toBeUndefined();
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
    expect(captured.warnings.some(w => w.includes("Бег"))).toBe(true);
  });

  it("не Повален — Натиск и Бег работают как раньше", async () => {
    const a1 = fakeActor();
    await declareCharge(a1);
    expect(a1.system.meleeBase).toBe("charge");
    const a2 = fakeActor();
    await declareRun(a2);
    expect(a2.getFlag("warhammer-dbc", "running")).toBe(true);
  });
});

// Потеря обеих ног (стр. 30-31, wdbc-r5o7.5): «не может ходить» — жёсткий
// запрет на ВСЕ пять боевых Действий Движения, тем же приёмом, что Повален
// блокирует Натиск/Бег выше, только шире (Полудвижение/Полное/Выход из Боя
// тоже недоступны, не только Натиск/Бег).
describe("Потеря обеих ног блокирует всё Движение", () => {
  const legless = () => fakeActor({ conditions: { lostLegs: true, lostLegsCount: 2 } });

  it.each([
    ["Полудвижение", declareHalfMove, "movedThisTurn"],
    ["Полное Движение", declareFullMove, "movedThisTurn"],
    ["Натиск", declareCharge, "meleeBase"],
    ["Бег", declareRun, "running"],
    ["Выход из Боя", declareDisengage, "disengageActive"]
  ])("%s — предупреждение, ничего не меняется", async (_label, fn, sideEffectFlag) => {
    const actor = legless();
    await fn(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
    if (sideEffectFlag === "meleeBase") expect(actor.system.meleeBase).toBeUndefined();
    else expect(actor.getFlag("warhammer-dbc", sideEffectFlag)).toBeUndefined();
    expect(captured.warnings.some(w => w.includes("ног"))).toBe(true);
  });

  it("одна потерянная нога (не обе) — Движение не блокируется этим правилом", async () => {
    const actor = fakeActor({ conditions: { lostLegs: true, lostLegsCount: 1 } });
    await declareHalfMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });
});

// Потеря обеих стоп («Раны и Урон», стр. 43; wdbc-x1nz.2.97 п.4): «требует
// броска на Acrobatics–10 просто чтобы ходить». Раньше — Dialog.confirm
// «бросок сделан?» и только у Полу/Полного/Выхода из Боя; теперь настоящий
// бросок на всех боевых движениях, включая Натиск и Бег. Акробатика 50 −10
// (бросок) −20 (тесты Движения той же потери стоп) = порог 20.
describe("Потеря обеих стоп — бросок Acrobatics−10 на каждом движении", () => {
  const footless = () => fakeActor({
    conditions: { lostFeet: true, lostFeetCount: 2 },
    skills: { acrobatics: { total: 50 } }
  });
  const moves = [
    ["Полудвижение", declareHalfMove, "movedThisTurn"],
    ["Полное Движение", declareFullMove, "movedThisTurn"],
    ["Натиск", declareCharge, "meleeBase"],
    ["Бег", declareRun, "running"],
    ["Выход из Боя", declareDisengage, "disengageActive"]
  ];

  it.each(moves)("%s — провал броска: движения нет, карточка провала в чате", async (_l, fn, side) => {
    captured.nextRoll = 90;
    const actor = footless();
    await fn(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
    if (side === "meleeBase") expect(actor.system.meleeBase).toBeUndefined();
    else expect(actor.getFlag("warhammer-dbc", side)).toBeUndefined();
    expect(captured.rolls).toContain("1d100");
    expect(captured.chat.some(m => String(m.content).includes("Не удержал равновесие"))).toBe(true);
  });

  it.each(moves)("%s — успех броска: движение проходит", async (_l, fn) => {
    captured.nextRoll = 10;
    const actor = footless();
    await fn(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(captured.chat.some(m => String(m.content).includes("Удержался на обрубках"))).toBe(true);
  });

  it("порог — Акробатика −10 и −20 тестов Движения от потери стоп (итог 20)", async () => {
    captured.nextRoll = 21; // при пороге 40 (без −20) был бы успех
    const actor = footless();
    await declareHalfMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
  });

  it("одна потерянная стопа (не обе) — броска нет вовсе", async () => {
    captured.nextRoll = 99;
    const actor = fakeActor({ conditions: { lostFeet: true, lostFeetCount: 1 } });
    await declareHalfMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(captured.rolls).toEqual([]);
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

describe("moveDegreeThisTurn (Snapshot/Выстрел Навскидку, wdbc-1rno)", () => {
  it("Полудвижение и Выход из Боя — degree=half (одна физическая дистанция SPD×1)", async () => {
    const a1 = fakeActor(); await declareHalfMove(a1);
    expect(a1.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("half");
    const a2 = fakeActor(); await declareDisengage(a2);
    expect(a2.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("half");
  });

  it("Полное Движение/Натиск/Бег — degree=full", async () => {
    const a1 = fakeActor(); await declareFullMove(a1);
    expect(a1.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("full");
    const a2 = fakeActor(); await declareCharge(a2);
    expect(a2.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("full");
    const a3 = fakeActor(); await declareRun(a3);
    expect(a3.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("full");
  });

  it("markMoveDegreeThisTurn монотонна: full не откатывается на half в том же Ходу", async () => {
    const actor = fakeActor();
    await markMoveDegreeThisTurn(actor, "full");
    await markMoveDegreeThisTurn(actor, "half");
    expect(actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("full");
  });

  it("markMoveDegreeThisTurn: half → half не переписывает флаг лишний раз", async () => {
    const actor = fakeActor();
    await markMoveDegreeThisTurn(actor, "half");
    let calls = 0;
    const originalSetFlag = actor.setFlag;
    actor.setFlag = async (...args) => { calls++; return originalSetFlag(...args); };
    await markMoveDegreeThisTurn(actor, "half");
    expect(calls).toBe(0);
  });

  it("без актора — не падает", async () => {
    await expect(markMoveDegreeThisTurn(null, "half")).resolves.toBeUndefined();
  });
});

// wdbc-8zi (п.7): declareDisengage — единственное из пяти боевых Действий
// Движения со своей веткой (Вызов/Challenge), которую остальные тесты этого
// файла не задевают вовсе — они гоняют только общие для всех пяти ветки
// (Повален/обе ноги/обе стопы). Dialog.confirm — тот же приём, что у
// диалога Acrobatics−10 выше (foundry-stub.mjs, captured.confirmAnswer).
describe("Вызов (Challenge) спрашивает подтверждение перед Выходом из Боя", () => {
  const challenged = () => fakeActor({ conditions: { challenged: true } });

  it("отказ в диалоге — Движение не происходит, флаги не ставятся", async () => {
    captured.confirmAnswer = false;
    const actor = challenged();
    await declareDisengage(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBeUndefined();
  });

  it("подтверждение — Выход из Боя проходит как обычно", async () => {
    captured.confirmAnswer = true;
    const actor = challenged();
    await declareDisengage(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
  });

  it("нет Вызова — диалог не спрашивается вовсе", async () => {
    captured.confirmAnswer = false; // если бы диалог всё же спросили — блокировало бы
    const actor = fakeActor();
    await declareDisengage(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });
});
