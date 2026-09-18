// test/combat/vehicle-force-move.test.mjs
//
// Против Техники (стр. 27): встречный Athletics(S) атакующего vs Operate(A)+20
// пилота, пилот временно Unnatural A(2×разница), если не имеет лучше.
// wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pilotOperateThreshold, useVehiclePushContest } from "../../module/combat/vehicle-force-move.mjs";

function actor({ athletics = 40, operate = 40, ap = 2, spd = 4, traits = [] } = {}) {
  return {
    id: "a1", name: "Гвардеец", type: "character", items: traits,
    system: {
      skills: { athletics: { total: athletics }, operate: { total: operate } },
      actionPoints: { value: ap, max: 2 },
      movement: { spd }
    },
    update: async () => {}
  };
}

function unnaturalAgTrait(rating) {
  return {
    type: "trait", name: `Unnatural Agility (${rating}) / Сверхъестественная Ловкость`,
    system: { effects: { charBonuses: [{ stat: "ag", value: rating }] } }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { delete globalThis.game.combat; });

describe("pilotOperateThreshold", () => {
  it("без Unnatural A и без разницы Размеров — просто Operate+20, без бонуса Успехов", () => {
    const { threshold, degreeBonus, tempRating, ownRating } = pilotOperateThreshold(actor({ operate: 40 }), 0);
    expect(threshold).toBe(60);
    expect(degreeBonus).toBe(0);
    expect(tempRating).toBe(0);
    expect(ownRating).toBe(0);
  });

  it("разница Размеров 2 — временный Unnatural A(4), +2 Успеха на успешный тест", () => {
    const { degreeBonus, tempRating } = pilotOperateThreshold(actor({ operate: 40 }), 2);
    expect(tempRating).toBe(4);
    expect(degreeBonus).toBe(2); // floor(4/2)
  });

  it("уже есть Unnatural A(6) лучше временного (4) — своё побеждает, не занижается", () => {
    const pilot = actor({ operate: 40, traits: [unnaturalAgTrait(6)] });
    const { tempRating, ownRating } = pilotOperateThreshold(pilot, 2);
    expect(ownRating).toBe(6);
    expect(tempRating).toBe(6); // max(6, 2*2=4) = 6, своё не занижено
  });
});

describe("useVehiclePushContest", () => {
  it("не хватает ОД в бою — предупреждает, никто не бросает", async () => {
    globalThis.game.combat = { started: true };
    const attacker = actor({ ap: 0 });
    const pilot = actor({ operate: 40 });
    await useVehiclePushContest(attacker, pilot, { mode: "push" });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("атакующий выигрывает — карточка с исходом и дистанцией", async () => {
    captured.nextRoll = 5; // и атакующий, и пилот берут этот же nextRoll (без dice-очереди)
    const attacker = actor({ athletics: 90, spd: 10 }); // высокий Athletics → много Успехов
    const pilot = actor({ operate: 10 }); // низкий Operate+20=30, тот же rv=5 даёт меньше Успехов
    await useVehiclePushContest(attacker, pilot, { mode: "push" });
    expect(captured.chat.length).toBe(1);
  });
});
