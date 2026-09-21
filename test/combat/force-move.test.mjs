// test/combat/force-move.test.mjs
//
// Через Силу / Массивные Предметы (стр. 27): Athletics(S)+0 за пределами
// весового лимита, Полное действие, обе руки; +штраф/Помеха при разнице
// Размеров. wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { forceMoveThreshold, forceMoveDistance, useForceMove } from "../../module/combat/force-move.mjs";

function actor({ athletics = 40, ap = 2, spd = 4 } = {}) {
  return {
    id: "a1", name: "Гвардеец", type: "character",
    system: {
      skills: { athletics: { total: athletics } },
      actionPoints: { value: ap, max: 2 },
      movement: { spd }
    },
    update: async () => {}
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});

describe("forceMoveThreshold", () => {
  it("без разницы в Размерах — обычный Athletics(S)+0", () => {
    const { threshold, massive } = forceMoveThreshold(actor({ athletics: 40 }));
    expect(threshold).toBe(40);
    expect(massive).toBe(false);
  });

  it("разница в Размерах 2 — штраф −20, помечен как массивный", () => {
    const { threshold, massive } = forceMoveThreshold(actor({ athletics: 40 }), { sizeDiff: 2 });
    expect(threshold).toBe(20);
    expect(massive).toBe(true);
  });

  it("отрицательная/нулевая разница — не массивный, штрафа нет", () => {
    expect(forceMoveThreshold(actor({ athletics: 40 }), { sizeDiff: 0 }).massive).toBe(false);
    expect(forceMoveThreshold(actor({ athletics: 40 }), { sizeDiff: -1 }).threshold).toBe(40);
  });
});

describe("forceMoveDistance", () => {
  it("Толкание — 0,5м за Успех, до SPD", () => {
    expect(forceMoveDistance("push", 3, 4)).toBe(1.5);
    expect(forceMoveDistance("push", 20, 4)).toBe(4); // капнуто SPD
  });

  it("Подъём/Переворот — 0,5м за Успех, до 2м", () => {
    expect(forceMoveDistance("lift", 3, 100)).toBe(1.5);
    expect(forceMoveDistance("lift", 10, 100)).toBe(2); // капнуто 2м, SPD не влияет
  });

  it("0 Успехов — 0м", () => {
    expect(forceMoveDistance("push", 0, 4)).toBe(0);
  });
});

describe("useForceMove", () => {
  afterEach(() => { delete globalThis.game.combat; });

  it("в бою, не хватает ОД на Через Силу — предупреждает, тест не бросается", async () => {
    globalThis.game.combat = { started: true };
    const a = actor({ ap: 0 });
    await useForceMove(a, { mode: "push", throughForce: true });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("успех Через Силу (push) — списывает 2 ОД, карточка с дистанцией", async () => {
    captured.nextRoll = 10; // Athletics 40 → успех, 4 Усп.
    const a = actor({ athletics: 40, ap: 2, spd: 10 });
    await useForceMove(a, { mode: "push", throughForce: true });
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("сдвинуто на");
  });

  it("массивный предмет БЕЗ Через Силы — штраф без Полного действия (ОД не тратятся)", async () => {
    captured.nextRoll = 10;
    const a = actor({ athletics: 40, ap: 0 }); // 0 ОД, но throughForce:false не должно их спрашивать
    await useForceMove(a, { mode: "lift", sizeDiff: 2, throughForce: false });
    expect(captured.warnings.length).toBe(0);
    expect(captured.chat.length).toBe(1);
  });

  it("Через Силу + массивный предмет — один тест с Помехой (двойной бросок)", async () => {
    captured.dice = [50, 5]; // Помеха keepWorst — оставит 50
    const a = actor({ athletics: 40, ap: 2 });
    await useForceMove(a, { mode: "lift", sizeDiff: 1, throughForce: true });
    expect(captured.rolls.length).toBe(2); // два d100 в очереди Roll — Помеха бросила дважды
  });
});
