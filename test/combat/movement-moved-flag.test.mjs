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

// Потеря обеих стоп (стр. 30-31, wdbc-r5o7.5): не запрет, а обязательный
// Acrobatics−10 «просто чтобы идти» — Dialog.confirm тем же приёмом, что и
// Вызов/Challenge (declareDisengage выше), captured.confirmAnswer в тесте
// играет роль «бросок сделан и успешен».
describe("Потеря обеих стоп требует подтверждения Acrobatics−10", () => {
  const footless = () => fakeActor({ conditions: { lostFeet: true, lostFeetCount: 2 } });

  it("отказ в диалоге — Движение не происходит", async () => {
    captured.confirmAnswer = false;
    const actor = footless();
    await declareHalfMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
  });

  it("подтверждение — Движение проходит как обычно", async () => {
    captured.confirmAnswer = true;
    const actor = footless();
    await declareFullMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
  });

  it("одна потерянная стопа (не обе) — диалог не нужен вовсе", async () => {
    captured.confirmAnswer = false; // если бы диалог всё же спросили — блокировало бы
    const actor = fakeActor({ conditions: { lostFeet: true, lostFeetCount: 1 } });
    await declareHalfMove(actor);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
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
