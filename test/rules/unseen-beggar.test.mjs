// test/rules/unseen-beggar.test.mjs
//
// Незримый Нищий / Unseen Beggar (Дар Нургла, wdbc-1rno): чары накладываются,
// только пока НАДЕТО одно снаряжение Качеством Poor.Q.

import { describe, it, expect } from "vitest";
import {
  isUnseenBeggarItem, betterThanPoorEquipped, unseenBeggarGateOk, UNSEEN_BEGGAR
} from "../../module/rules/unseen-beggar.mjs";

const gear = (type, quality, equipped, name = type) => ({ type, name, system: { quality, equipped } });

function giftItem({ type = "mutation", key = UNSEEN_BEGGAR, name = "Х" } = {}) {
  return { type, name, flags: { "warhammer-dbc": { mechanics: key
    ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key }] }]
    : [] } } };
}

describe("isUnseenBeggarItem", () => {
  it("опознаёт по ключу Возможности", () => {
    expect(isUnseenBeggarItem(giftItem())).toBe(true);
  });
  it("опознаёт по билингвальному имени", () => {
    expect(isUnseenBeggarItem(giftItem({ key: null, name: "Unseen Beggar / Незримый Нищий" }))).toBe(true);
  });
});

describe("betterThanPoorEquipped", () => {
  it("всё надетое Poor.Q — препятствий нет", () => {
    const items = [gear("armor", "poor", true), gear("weapon", "poor", true), gear("gear", "poor", true)];
    expect(betterThanPoorEquipped(items)).toEqual([]);
    expect(unseenBeggarGateOk(items)).toBe(true);
  });

  it("один надетый предмет лучше Poor.Q — он и назван виновником", () => {
    const items = [gear("armor", "poor", true), gear("weapon", "good", true, "Меч")];
    expect(betterThanPoorEquipped(items)).toEqual([{ name: "Меч", quality: "good" }]);
    expect(unseenBeggarGateOk(items)).toBe(false);
  });

  it("хорошее снаряжение в рюкзаке (не надето) на вид не влияет", () => {
    expect(unseenBeggarGateOk([gear("weapon", "best", false)])).toBe(true);
  });

  it("вживлённый имплант не считается «ношением» — Дар не запирает", () => {
    expect(unseenBeggarGateOk([gear("implant", "best", true)])).toBe(true);
  });

  it("предметы без Качества вообще (Талант, Мутация) не мешают", () => {
    expect(unseenBeggarGateOk([giftItem(), { type: "talent", name: "T", system: {} }])).toBe(true);
  });

  it("пустое Качество читается как common, а не как poor", () => {
    expect(betterThanPoorEquipped([gear("gear", "", true, "Тряпьё")]))
      .toEqual([{ name: "Тряпьё", quality: "common" }]);
  });

  it("щит (forcefield) тоже снаряжение", () => {
    expect(unseenBeggarGateOk([gear("forcefield", "common", true)])).toBe(false);
  });
});
