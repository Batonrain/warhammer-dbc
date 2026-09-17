// test/rules/limb-loss.test.mjs
//
// wdbc-1rno.6 (стр. 30-31): «Обрубок конечности нуждается в медицинской
// обработке, иначе через T.b дней с шансом 80% он загноится» — чистая
// логика планирования/чтения таймера, без Foundry (см. module/rules/
// limb-loss.mjs).

import { describe, it, expect } from "vitest";
import {
  LIMB_LOSS_KEYS, limbLossGangreneField, limbLossGangreneCheckAt, dueLimbLossGangreneKeys
} from "../../module/rules/limb-loss.mjs";

describe("LIMB_LOSS_KEYS / limbLossGangreneField", () => {
  it("пять частей тела книги «Потеря Конечностей»", () => {
    expect(LIMB_LOSS_KEYS).toEqual(["lostHands", "lostArms", "lostFeet", "lostLegs", "lostEyes"]);
  });

  it("имя поля-таймера — ключ + GangreneAt", () => {
    expect(limbLossGangreneField("lostHands")).toBe("lostHandsGangreneAt");
    expect(limbLossGangreneField("lostEyes")).toBe("lostEyesGangreneAt");
  });

  it("чужой ключ — null", () => {
    expect(limbLossGangreneField("bleeding")).toBeNull();
    expect(limbLossGangreneField("")).toBeNull();
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

describe("dueLimbLossGangreneKeys — какие таймеры просрочены", () => {
  it("таймер в будущем — не просрочен", () => {
    const conditions = { lostHandsGangreneAt: 2000 };
    expect(dueLimbLossGangreneKeys(conditions, 1000)).toEqual([]);
  });

  it("таймер точно сейчас или в прошлом — просрочен", () => {
    expect(dueLimbLossGangreneKeys({ lostHandsGangreneAt: 1000 }, 1000)).toEqual(["lostHands"]);
    expect(dueLimbLossGangreneKeys({ lostHandsGangreneAt: 999 }, 1000)).toEqual(["lostHands"]);
  });

  it("0/отсутствующий таймер — не считается запланированным", () => {
    expect(dueLimbLossGangreneKeys({ lostHandsGangreneAt: 0 }, 1000)).toEqual([]);
    expect(dueLimbLossGangreneKeys({}, 1000)).toEqual([]);
  });

  it("несколько просроченных сразу — все ключи", () => {
    const conditions = { lostHandsGangreneAt: 500, lostEyesGangreneAt: 900, lostLegsGangreneAt: 5000 };
    expect(dueLimbLossGangreneKeys(conditions, 1000)).toEqual(["lostHands", "lostEyes"]);
  });

  it("нет conditions вовсе — пустой список, без падения", () => {
    expect(dueLimbLossGangreneKeys(null, 1000)).toEqual([]);
    expect(dueLimbLossGangreneKeys(undefined, 1000)).toEqual([]);
  });
});
