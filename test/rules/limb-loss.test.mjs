// test/rules/limb-loss.test.mjs
//
// wdbc-1rno.6 (стр. 30-31): «Обрубок конечности нуждается в медицинской
// обработке, иначе через T.b дней с шансом 80% он загноится» — чистая
// логика планирования/чтения таймера, без Foundry (см. module/rules/
// limb-loss.mjs).

import { describe, it, expect } from "vitest";
import {
  LIMB_LOSS_KEYS, BODY_SIDES, lostSideKey, LOST_SIDE_KEYS, lostSides, lostCount, isLostOn,
  sideOfLimb, limbLossGangreneCheckAt, lostSideFields, pickLostSide, lostCountFields,
  clearStumpTimerFields, stumpSidesWithTimer, dueLimbLossGangreneSides,
  derivedLimbLossConditions, lostSidesLabel
} from "../../module/rules/limb-loss.mjs";

describe("LIMB_LOSS_KEYS / lostSideKey / LOST_SIDE_KEYS", () => {
  it("пять частей тела книги «Потеря Конечностей»", () => {
    expect(LIMB_LOSS_KEYS).toEqual(["lostHands", "lostArms", "lostFeet", "lostLegs", "lostEyes"]);
  });

  it("BODY_SIDES — правая, левая, в этом порядке (заполнение «первой целой»)", () => {
    expect(BODY_SIDES).toEqual(["right", "left"]);
  });

  it("lostSideKey — сторона + часть тела", () => {
    expect(lostSideKey("lostHands", "right")).toBe("rightHand");
    expect(lostSideKey("lostEyes", "left")).toBe("leftEye");
  });

  it("lostSideKey — чужой ключ/сторона — null", () => {
    expect(lostSideKey("bleeding", "right")).toBeNull();
    expect(lostSideKey("lostHands", "up")).toBeNull();
  });

  it("LOST_SIDE_KEYS — все десять ключей system.lostLimbs", () => {
    expect(LOST_SIDE_KEYS).toEqual([
      "rightHand", "leftHand", "rightArm", "leftArm", "rightFoot", "leftFoot",
      "rightLeg", "leftLeg", "rightEye", "leftEye"
    ]);
  });
});

describe("lostSides / lostCount / isLostOn", () => {
  it("ничего не потеряно — пустой список, 0", () => {
    const system = { lostLimbs: {} };
    expect(lostSides(system, "lostHands")).toEqual([]);
    expect(lostCount(system, "lostHands")).toBe(0);
    expect(isLostOn(system, "lostHands", "right")).toBe(false);
  });

  it("одна сторона потеряна — считается только она", () => {
    const system = { lostLimbs: { rightHand: { lost: true } } };
    expect(lostSides(system, "lostHands")).toEqual(["right"]);
    expect(lostCount(system, "lostHands")).toBe(1);
    expect(isLostOn(system, "lostHands", "right")).toBe(true);
    expect(isLostOn(system, "lostHands", "left")).toBe(false);
  });

  it("обе стороны потеряны — count 2, обе в списке", () => {
    const system = { lostLimbs: { rightLeg: { lost: true }, leftLeg: { lost: true } } };
    expect(lostSides(system, "lostLegs")).toEqual(["right", "left"]);
    expect(lostCount(system, "lostLegs")).toBe(2);
  });
});

describe("sideOfLimb — сторона из ключа места попадания", () => {
  it("rightArm/leftLeg — right/left", () => {
    expect(sideOfLimb("rightArm")).toBe("right");
    expect(sideOfLimb("leftLeg")).toBe("left");
  });
  it("не начинается с right/left — пустая строка", () => {
    expect(sideOfLimb("head")).toBe("");
    expect(sideOfLimb("")).toBe("");
    expect(sideOfLimb(undefined)).toBe("");
  });
});

describe("limbLossGangreneCheckAt — T.b дней от worldTime", () => {
  it("T.b 3 — +3 суток (259200 сек)", () => {
    expect(limbLossGangreneCheckAt(1000, 3)).toBe(1000 + 3 * 86400);
  });
  it("T.b 0 — сразу текущий момент", () => {
    expect(limbLossGangreneCheckAt(1000, 0)).toBe(1000);
  });
  it("T.b не число — трактуется как 0", () => {
    expect(limbLossGangreneCheckAt(1000, undefined)).toBe(1000);
  });
});

describe("lostSideFields — патч на потерю/возврат конкретной стороны", () => {
  it("lost:true без timer — обрубок закрыт, таймер не заводится", () => {
    expect(lostSideFields("lostHands", "right")).toEqual({
      "system.lostLimbs.rightHand.lost": true, "system.lostLimbs.rightHand.gangreneAt": 0, "system.lostLimbs.rightHand.mutation": false
    });
  });

  it("lost:true с timer — таймер worldTime + T.b дней", () => {
    expect(lostSideFields("lostArms", "left", { timer: true, worldTime: 1000, tb: 2 })).toEqual({
      "system.lostLimbs.leftArm.lost": true, "system.lostLimbs.leftArm.gangreneAt": 1000 + 2 * 86400, "system.lostLimbs.leftArm.mutation": false
    });
  });

  it("lost:false — вернуть (пришита/бионика), таймер гасится", () => {
    expect(lostSideFields("lostEyes", "right", { lost: false })).toEqual({
      "system.lostLimbs.rightEye.lost": false, "system.lostLimbs.rightEye.gangreneAt": 0, "system.lostLimbs.rightEye.mutation": false
    });
  });

  it("чужой ключ — пустой патч", () => {
    expect(lostSideFields("bleeding", "right")).toEqual({});
  });
});

describe("pickLostSide — какую сторону взять", () => {
  it("новая потеря (lost:true) — первая целая по порядку BODY_SIDES", () => {
    expect(pickLostSide({ lostLimbs: {} }, "lostHands", "", { lost: true })).toBe("right");
    expect(pickLostSide({ lostLimbs: { rightHand: { lost: true } } }, "lostHands", "", { lost: true })).toBe("left");
  });

  it("обе целые/обе потеряны — предпочтение уважается, если подходит", () => {
    expect(pickLostSide({ lostLimbs: {} }, "lostHands", "left", { lost: true })).toBe("left");
  });

  it("предпочтение не подходит (уже занято под искомое состояние) — берётся другая", () => {
    const system = { lostLimbs: { leftHand: { lost: true } } };
    expect(pickLostSide(system, "lostHands", "left", { lost: true })).toBe("right");
  });

  it("снятие (lost:false) — последняя потерянная по обратному порядку", () => {
    const system = { lostLimbs: { rightHand: { lost: true }, leftHand: { lost: true } } };
    expect(pickLostSide(system, "lostHands", "", { lost: false })).toBe("left");
  });

  it("нечего взять — null", () => {
    const system = { lostLimbs: { rightHand: { lost: true }, leftHand: { lost: true } } };
    expect(pickLostSide(system, "lostHands", "", { lost: true })).toBeNull();
  });
});

describe("lostCountFields — довести число потерь до target", () => {
  it("0 → 1 — новая потеря на первой целой стороне", () => {
    expect(lostCountFields({ lostLimbs: {} }, "lostHands", 1)).toEqual({
      "system.lostLimbs.rightHand.lost": true, "system.lostLimbs.rightHand.gangreneAt": 0, "system.lostLimbs.rightHand.mutation": false
    });
  });

  it("0 → 2 — обе стороны разом", () => {
    expect(lostCountFields({ lostLimbs: {} }, "lostLegs", 2)).toEqual({
      "system.lostLimbs.rightLeg.lost": true, "system.lostLimbs.rightLeg.gangreneAt": 0, "system.lostLimbs.rightLeg.mutation": false,
      "system.lostLimbs.leftLeg.lost": true, "system.lostLimbs.leftLeg.gangreneAt": 0, "system.lostLimbs.leftLeg.mutation": false
    });
  });

  it("новая потеря с timer — таймер только у новых сторон", () => {
    expect(lostCountFields({ lostLimbs: {} }, "lostEyes", 1, { timer: true, worldTime: 1000, tb: 3 })).toEqual({
      "system.lostLimbs.rightEye.lost": true, "system.lostLimbs.rightEye.gangreneAt": 1000 + 3 * 86400, "system.lostLimbs.rightEye.mutation": false
    });
  });

  it("2 → 1 — снимает последнюю потерянную", () => {
    const system = { lostLimbs: { rightHand: { lost: true }, leftHand: { lost: true } } };
    expect(lostCountFields(system, "lostHands", 1)).toEqual({
      "system.lostLimbs.leftHand.lost": false, "system.lostLimbs.leftHand.gangreneAt": 0, "system.lostLimbs.leftHand.mutation": false
    });
  });

  it("target зажимается в [0, 2]", () => {
    expect(lostCountFields({ lostLimbs: {} }, "lostHands", 99)).toEqual({
      "system.lostLimbs.rightHand.lost": true, "system.lostLimbs.rightHand.gangreneAt": 0, "system.lostLimbs.rightHand.mutation": false,
      "system.lostLimbs.leftHand.lost": true, "system.lostLimbs.leftHand.gangreneAt": 0, "system.lostLimbs.leftHand.mutation": false
    });
  });

  it("чужой ключ — пустой патч", () => {
    expect(lostCountFields({ lostLimbs: {} }, "bleeding", 1)).toEqual({});
  });
});

describe("clearStumpTimerFields / stumpSidesWithTimer", () => {
  it("clearStumpTimerFields — только gangreneAt в 0, флаг не трогает", () => {
    expect(clearStumpTimerFields("lostFeet", "right")).toEqual({ "system.lostLimbs.rightFoot.gangreneAt": 0 });
  });

  it("stumpSidesWithTimer — только потерянные стороны с идущим таймером", () => {
    const system = { lostLimbs: {
      rightHand: { lost: true, gangreneAt: 1000 },
      leftHand:  { lost: true, gangreneAt: 0 }
    } };
    expect(stumpSidesWithTimer(system, "lostHands")).toEqual(["right"]);
  });
});

describe("dueLimbLossGangreneSides — какие таймеры просрочены", () => {
  it("таймер в будущем — не просрочен", () => {
    const system = { lostLimbs: { rightHand: { lost: true, gangreneAt: 2000 } } };
    expect(dueLimbLossGangreneSides(system, 1000)).toEqual([]);
  });

  it("таймер точно сейчас или в прошлом — просрочен", () => {
    const system = { lostLimbs: { rightHand: { lost: true, gangreneAt: 1000 } } };
    expect(dueLimbLossGangreneSides(system, 1000)).toEqual([{ key: "lostHands", side: "right" }]);
    system.lostLimbs.rightHand.gangreneAt = 999;
    expect(dueLimbLossGangreneSides(system, 1000)).toEqual([{ key: "lostHands", side: "right" }]);
  });

  it("0/отсутствующий таймер — не считается запланированным", () => {
    expect(dueLimbLossGangreneSides({ lostLimbs: { rightHand: { lost: true, gangreneAt: 0 } } }, 1000)).toEqual([]);
    expect(dueLimbLossGangreneSides({ lostLimbs: {} }, 1000)).toEqual([]);
  });

  it("не потеряна — таймер (если остался от старого) не считается", () => {
    const system = { lostLimbs: { rightHand: { lost: false, gangreneAt: 500 } } };
    expect(dueLimbLossGangreneSides(system, 1000)).toEqual([]);
  });

  it("несколько просроченных сразу — все пары key+side", () => {
    const system = { lostLimbs: {
      rightHand: { lost: true, gangreneAt: 500 },
      leftEye:   { lost: true, gangreneAt: 900 },
      rightLeg:  { lost: true, gangreneAt: 5000 }
    } };
    expect(dueLimbLossGangreneSides(system, 1000)).toEqual([
      { key: "lostHands", side: "right" }, { key: "lostEyes", side: "left" }
    ]);
  });

  it("нет lostLimbs вовсе — пустой список, без падения", () => {
    expect(dueLimbLossGangreneSides({}, 1000)).toEqual([]);
    expect(dueLimbLossGangreneSides(null, 1000)).toEqual([]);
  });
});

describe("derivedLimbLossConditions — флаг и *Count из сторон", () => {
  it("ничего не потеряно — все флаги false, счётчики 0", () => {
    const out = derivedLimbLossConditions({ lostLimbs: {} });
    expect(out.lostHands).toBe(false);
    expect(out.lostHandsCount).toBe(0);
  });

  it("одна сторона — флаг true, счётчик 1", () => {
    const out = derivedLimbLossConditions({ lostLimbs: { rightArm: { lost: true } } });
    expect(out.lostArms).toBe(true);
    expect(out.lostArmsCount).toBe(1);
  });

  it("обе стороны — счётчик 2", () => {
    const out = derivedLimbLossConditions({ lostLimbs: { rightLeg: { lost: true }, leftLeg: { lost: true } } });
    expect(out.lostLegs).toBe(true);
    expect(out.lostLegsCount).toBe(2);
  });
});

describe("lostSidesLabel", () => {
  it("одна сторона — краткая подпись", () => {
    expect(lostSidesLabel({ lostLimbs: { rightHand: { lost: true } } }, "lostHands")).toBe("П.");
  });
  it("обе стороны — «П. и Л.»", () => {
    const system = { lostLimbs: { rightHand: { lost: true }, leftHand: { lost: true } } };
    expect(lostSidesLabel(system, "lostHands")).toBe("П. и Л.");
  });
  it("ничего не потеряно — пустая строка", () => {
    expect(lostSidesLabel({ lostLimbs: {} }, "lostHands")).toBe("");
  });
});
