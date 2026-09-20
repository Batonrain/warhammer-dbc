// test/combat/movement-actions-od-and-disadvantage.test.mjs
//
// Стр. 28-29, wdbc-x1nz.2.34:
//  - «Карабканье и Прыжки — Полное действие» (2 ОД) — раньше тест катился
//    без расхода ОД вовсе.
//  - «После Полного Движения можно ещё полудействие (не Атаку), но его
//    тесты — с Помехой» — реализовано для следующего Карабканья/Прыжка/
//    Плавания этого же Хода (общий _d100(threshold, actor)), остальные
//    полудействия разбросаны по десяткам диалогов и не подключены.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  declareFullMove, _resolveClimb, _resolveJump, _resolveSwim
} from "../../module/combat/movement-actions.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 }, ...overrides } = {}) {
  const store = {};
  const doc = {
    name: "Подставной", type: "character", items: [],
    system: { actionPoints, characteristics: { s: { total: 40, bonus: 4 }, ag: { total: 35, bonus: 3 } }, ...overrides }
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  doc.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("Карабканье/Прыжок: Полное действие (2 ОД)", () => {
  it("_resolveClimb вне боя — ОД не считаются, тест проходит", async () => {
    captured.dice = [10];
    const actor = actorFor();
    await _resolveClimb(actor, "simple", 40, 30, 0, 8);
    expect(captured.chat).toHaveLength(1);
  });

  it("_resolveClimb в бою — списывает 2 ОД", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [10];
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await _resolveClimb(actor, "simple", 40, 30, 0, 8);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(captured.chat).toHaveLength(1);
  });

  it("_resolveClimb в бою без ОД — блокируется, тест не катится", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 1, max: 2 } });
    await _resolveClimb(actor, "simple", 40, 30, 0, 8);
    expect(captured.chat).toHaveLength(0);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("_resolveJump в бою — списывает 2 ОД, без ОД блокируется", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [10];
    const ok = actorFor({ actionPoints: { value: 2, max: 2 } });
    await _resolveJump(ok, "hplace", 40, 0, 0, 4);
    expect(ok.system.actionPoints.value).toBe(0);

    resetCaptured();
    const broke = actorFor({ actionPoints: { value: 0, max: 2 } });
    await _resolveJump(broke, "hplace", 40, 0, 0, 4);
    expect(captured.chat).toHaveLength(0);
  });

  it("_resolveSwim — ОД не списывает (книга не даёт ему отдельной цены действия)", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [10];
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await _resolveSwim(actor, 40, false, false, 0, 4);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.chat).toHaveLength(1);
  });
});

describe("Полное Движение → Помеха следующему Карабканью/Прыжку/Плаванию", () => {
  it("declareFullMove ставит флаг fullMoveDisadvantage", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 2, max: 2 }, movement: { move: 8 } });
    await declareFullMove(actor);
    expect(actor.getFlag("warhammer-dbc", "fullMoveDisadvantage")).toBe(true);
  });

  it("следующее Карабканье берёт худший из двух d100 и гасит флаг", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 4, max: 4 }, movement: { move: 8 } });
    await declareFullMove(actor);
    resetCaptured();
    // Порог Athletics 40: 30 — успех, 80 — провал. Помеха берёт худший (80).
    captured.dice = [30, 80];
    await _resolveClimb(actor, "simple", 40, 30, 0, 8);
    expect(captured.chat.at(-1).content).toContain("Провал");
    expect(actor.getFlag("warhammer-dbc", "fullMoveDisadvantage")).toBeUndefined();
  });

  it("без Помехи (флаг не стоит) — обычный одиночный бросок", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [30];
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await _resolveClimb(actor, "simple", 40, 30, 0, 8);
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("Помеха тратится один раз — второй тест того же Хода уже обычный", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 6, max: 6 }, movement: { move: 8 } });
    await declareFullMove(actor);
    resetCaptured();
    captured.dice = [30, 80]; // первый тест — с Помехой, берёт 80 (провал)
    await _resolveClimb(actor, "simple", 40, 30, 0, 8);
    expect(captured.chat.at(-1).content).toContain("Провал");

    resetCaptured();
    captured.dice = [30]; // второй тест — уже без Помехи, один бросок
    await _resolveJump(actor, "hplace", 40, 0, 0, 4);
    expect(captured.chat.at(-1).content).toContain("Успех");
  });
});
