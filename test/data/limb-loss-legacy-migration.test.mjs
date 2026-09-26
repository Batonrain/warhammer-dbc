// test/data/limb-loss-legacy-migration.test.mjs
//
// До wdbc-x1nz.2.100 потеря конечностей лежала в system.conditions:
// lostArms (флаг), lostArmsCount (0-2), lostArmsGangreneAt (таймер обрубка).
// Схема эти поля больше не описывает и вычищает их при загрузке — без
// переноса у покалеченных персонажей живого мира конечности «отрастали»,
// а таймер Гангрены обрубка пропадал (приёмка #518-#526).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { lostCount, isLostOn } from "../../module/rules/limb-loss.mjs";
import { tokenLimbLossPatch } from "../../module/migrations/limb-loss-sides.mjs";

const legacy = {
  conditions: {
    lostArms: true, lostArmsCount: 2, lostArmsGangreneAt: 5000,
    lostEyes: true, lostEyesCount: 1,
    lostLegs: false, lostLegsCount: 1   // счётчик без флага — Состояние снято
  }
};

describe("перенос старой потери конечностей в system.lostLimbs", () => {
  for (const type of ["character", "minion", "daemon"]) {
    it(`${type}: старые флаг и счётчик раскладываются по сторонам`, () => {
      const sys = new ACTOR_DATA_MODELS[type](structuredClone(legacy));
      expect(lostCount(sys, "lostArms")).toBe(2);
      expect(sys.lostLimbs.rightArm.gangreneAt).toBe(5000);
      expect(sys.lostLimbs.leftArm.gangreneAt).toBe(5000);
      expect(lostCount(sys, "lostEyes")).toBe(1);
      expect(isLostOn(sys, "lostEyes", "right")).toBe(true);
      expect(lostCount(sys, "lostLegs")).toBe(0);
    });
  }

  it("флаг без счётчика — одна потеря", () => {
    const sys = new ACTOR_DATA_MODELS.character({ conditions: { lostHands: true } });
    expect(lostCount(sys, "lostHands")).toBe(1);
  });

  it("уже записанный lostLimbs главнее старых полей (конечность вернули)", () => {
    const sys = new ACTOR_DATA_MODELS.character({
      conditions: { lostArms: true, lostArmsCount: 1 },
      lostLimbs: { rightArm: { lost: false, gangreneAt: 0 } }
    });
    expect(lostCount(sys, "lostArms")).toBe(0);
  });
});

describe("tokenLimbLossPatch — дельта несвязанного токена", () => {
  const none = () => ({ rightArm: { lost: false, gangreneAt: 0, mutation: false },
                        leftArm:  { lost: false, gangreneAt: 0, mutation: false },
                        rightEye: { lost: false, gangreneAt: 0, mutation: false },
                        leftEye:  { lost: false, gangreneAt: 0, mutation: false } });

  it("старые поля в дельте → полный lostLimbs для записи в дельту", () => {
    const patch = tokenLimbLossPatch({ conditions: { lostArms: true, lostArmsCount: 1, lostArmsGangreneAt: 7 } }, none());
    expect(patch.rightArm).toEqual({ lost: true, gangreneAt: 7, mutation: false });
    expect(patch.leftArm.lost).toBe(false);
  });

  it("снятая в дельте потеря перекрывает потерю базового актора", () => {
    const base = none(); base.rightEye.lost = true;
    const patch = tokenLimbLossPatch({ conditions: { lostEyes: false, lostEyesCount: 0 } }, base);
    expect(patch.rightEye.lost).toBe(false);
  });

  it("нет старых полей или lostLimbs уже в дельте — править нечего", () => {
    expect(tokenLimbLossPatch({ conditions: { stunned: true } }, none())).toBeNull();
    expect(tokenLimbLossPatch({ conditions: { lostArms: true }, lostLimbs: {} }, none())).toBeNull();
    expect(tokenLimbLossPatch(undefined, none())).toBeNull();
  });
});
