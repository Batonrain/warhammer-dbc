// test/combat/joint-move.test.mjs
//
// Совместное Перемещение (стр. 27): весовые лимиты (не S.b+T.b) суммируются;
// бонус ассистентов — только сверх необходимого для превышения веса.
// wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { jointMoveCapacity, excessAssistCount, jointMoveSummary, useJointMove }
  from "../../module/combat/joint-move.mjs";

function actor({ push = 0, lift = 0, athletics = 40, ap = 2 } = {}) {
  return {
    id: `a-${Math.random()}`, name: "Участник", type: "character",
    system: {
      encumbrance: { push, lift },
      skills: { athletics: { total: athletics } },
      actionPoints: { value: ap, max: 2 },
      movement: { spd: 4 }
    },
    update: async () => {}
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { delete globalThis.game.combat; });

describe("jointMoveCapacity", () => {
  it("push читает encumbrance.push, lift читает encumbrance.lift", () => {
    const a = actor({ push: 100, lift: 200 });
    expect(jointMoveCapacity(a, "push")).toBe(100);
    expect(jointMoveCapacity(a, "lift")).toBe(200);
  });
});

describe("excessAssistCount", () => {
  it("ведущий один уже покрывает вес — все ассистенты лишние", () => {
    expect(excessAssistCount(100, [30, 20], 50)).toBe(2);
  });

  it("нужны все ассистенты — лишних нет", () => {
    expect(excessAssistCount(10, [10, 10], 30)).toBe(0);
  });

  it("первый ассистент нужен, второй уже лишний", () => {
    // lead=10, weight=15: 10<15 → 1-й (cap5) нужен (10<15, добавляем, cum=15);
    // 2-й: cum(15)>=15 → лишний.
    expect(excessAssistCount(10, [5, 100], 15)).toBe(1);
  });

  it("даже с ассистентами не хватает — 0 лишних", () => {
    expect(excessAssistCount(10, [5, 5], 100)).toBe(0);
  });
});

describe("jointMoveSummary", () => {
  it("сумма всех лимитов группы, sufficient и assistCount капнут DEFAULT_ASSIST_MAX", () => {
    const lead = actor({ lift: 10 });
    const a1 = actor({ lift: 50 });
    const a2 = actor({ lift: 50 });
    const a3 = actor({ lift: 50 });
    const summary = jointMoveSummary([lead, a1, a2, a3], "lift", 20);
    expect(summary.total).toBe(160);
    expect(summary.sufficient).toBe(true);
    // lead(10)<20 → a1(50) нужен, cum=60; a2 и a3 — лишние (2), но капается на 2 (DEFAULT_ASSIST_MAX)
    expect(summary.assistCount).toBe(2);
  });

  it("не хватает суммарно — sufficient:false", () => {
    const lead = actor({ lift: 5 });
    const a1 = actor({ lift: 5 });
    expect(jointMoveSummary([lead, a1], "lift", 100).sufficient).toBe(false);
  });
});

describe("useJointMove", () => {
  it("суммарной грузоподъёмности не хватает — предупреждает, тест не бросается", async () => {
    const lead = actor({ lift: 5 });
    await useJointMove(lead, [actor({ lift: 5 })], { mode: "lift", weight: 100 });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("в бою, не хватает ОД у ведущего — предупреждает", async () => {
    globalThis.game.combat = { started: true };
    const lead = actor({ lift: 100, ap: 0 });
    await useJointMove(lead, [], { mode: "lift", weight: 50 });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("успех — карточка с числом реально засчитанных помощников", async () => {
    captured.nextRoll = 10;
    const lead = actor({ lift: 10, athletics: 40 });
    const a1 = actor({ lift: 50 });
    const a2 = actor({ lift: 50 });
    await useJointMove(lead, [a1, a2], { mode: "lift", weight: 20 });
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Успех");
  });
});
